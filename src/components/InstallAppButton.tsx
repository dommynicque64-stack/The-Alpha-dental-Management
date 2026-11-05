import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
export default function InstallAppButton() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  useEffect(() => {
    const handler = (event: Event) => { event.preventDefault(); setPromptEvent(event as InstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  if (!promptEvent) return null;
  return <button type="button" onClick={async () => {
    await promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
  }} className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-white px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-50">
    <Download className="h-4 w-4" /> Install app
  </button>;
}
