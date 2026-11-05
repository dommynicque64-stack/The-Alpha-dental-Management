import auth from '../../api/auth.js';
import dashboard from '../../api/dashboard.js';
import patients from '../../api/patients.js';
import appointments from '../../api/appointments.js';
import dentalRecords from '../../api/dental-records.js';
import documents from '../../api/documents.js';
import invoices from '../../api/invoices.js';
import payments from '../../api/payments.js';
import prescriptions from '../../api/prescriptions.js';
import notifications from '../../api/notifications.js';
import settings from '../../api/settings.js';
import staff from '../../api/staff.js';
import treatments from '../../api/treatments.js';
import upload from '../../api/upload.js';
import publicSettings from '../../api/public-settings.js';

const routes = {
  auth, dashboard, patients, appointments,
  'dental-records': dentalRecords, documents, invoices, payments,
  prescriptions, notifications, settings, staff, treatments, upload, 'public-settings': publicSettings,
};

function getRoute(request, context) {
  const splat = context?.params?.splat;
  if (splat) return String(splat).replace(/^\/+|\/+$/g, '');
  const pathname = new URL(request.url).pathname;
  return pathname
    .replace(/^\/\.netlify\/functions\/api\/?/, '')
    .replace(/^\/api\/?/, '')
    .replace(/^\/+|\/+$/g, '');
}

function createResponse() {
  let statusCode = 200;
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
  let body = '';

  const res = {
    setHeader(name, value) { headers.set(name, String(value)); },
    status(code) { statusCode = code; return res; },
    json(value) {
      body = JSON.stringify(value);
      res._response = new Response(body, { status: statusCode, headers });
      return res._response;
    },
    end(value = '') {
      body = value;
      res._response = new Response(body, { status: statusCode, headers });
      return res._response;
    },
  };

  return res;
}

async function parseBody(request) {
  if (['GET', 'HEAD'].includes(request.method)) return undefined;
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const text = await request.text();
    if (!text) return {};
    try { return JSON.parse(text); } catch { throw new Error('Invalid JSON request body.'); }
  }
  return await request.text();
}

export default async function handler(request, context) {
  try {
    const route = getRoute(request, context);
    const target = routes[route];
    if (!target) {
      return Response.json({ error: `Unknown API route: ${route || '(empty)'}` }, { status: 404 });
    }

    const url = new URL(request.url);
    const req = {
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      query: Object.fromEntries(url.searchParams.entries()),
      body: await parseBody(request),
      url: request.url,
    };

    const res = createResponse();
    const result = await target(req, res);
    if (result instanceof Response) return result;
    if (res._response instanceof Response) return res._response;
    return Response.json({ error: 'The API handler did not return a response.' }, { status: 500 });
  } catch (error) {
    console.error('Netlify API adapter error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
