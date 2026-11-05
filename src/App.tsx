import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientNew from './pages/PatientNew';
import PatientDetail from './pages/PatientDetail';
import Appointments from './pages/Appointments';
import AppointmentNew from './pages/AppointmentNew';
import Treatments from './pages/Treatments';
import Billing from './pages/Billing';
import Reports from './pages/Reports';
import StaffPage from './pages/StaffPage';
import Settings from './pages/Settings';
import Docs from './pages/Docs';
import TodayPayments from './pages/TodayPayments';


export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/docs" element={<Docs />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<ProtectedRoute perm="dashboard"><Dashboard /></ProtectedRoute>} />
            <Route path="/patients" element={<ProtectedRoute perm="patients"><Patients /></ProtectedRoute>} />
            <Route path="/patients/new" element={<ProtectedRoute perm="patients"><PatientNew /></ProtectedRoute>} />
            <Route path="/patients/:id" element={<ProtectedRoute perm="patients"><PatientDetail /></ProtectedRoute>} />
            <Route path="/appointments" element={<ProtectedRoute perm="appointments"><Appointments /></ProtectedRoute>} />
            <Route path="/appointments/new" element={<ProtectedRoute perm="appointments"><AppointmentNew /></ProtectedRoute>} />
            <Route path="/treatments" element={<ProtectedRoute perm="treatments"><Treatments /></ProtectedRoute>} />
            <Route path="/billing" element={<ProtectedRoute perm="billing"><Billing /></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute perm="payments"><TodayPayments /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute perm="reports"><Reports /></ProtectedRoute>} />
            <Route path="/staff" element={<ProtectedRoute perm="__admin__"><StaffPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute perm="__admin__"><Settings /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
