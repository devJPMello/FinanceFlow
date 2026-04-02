import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import * as Sentry from '@sentry/react';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

const sentryDsn = import.meta.env.VITE_SENTRY_DSN?.trim();
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.VITE_ENV || import.meta.env.MODE,
    sendDefaultPii: false,
  });
}

const rawKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? '';
const publishableKey = rawKey.trim();

/** Chave real do Clerk (placeholders como pk_test_COLE_AQUI quebram o Provider e deixam a tela branca). */
function isValidClerkPublishableKey(key: string): boolean {
  if (!key) return false;
  const okPrefix = key.startsWith('pk_test_') || key.startsWith('pk_live_');
  if (!okPrefix || key.length < 32) return false;
  if (/COLE_AQUI|your_publishable|changeme|example/i.test(key)) return false;
  return true;
}

const clerkKeyOk = isValidClerkPublishableKey(publishableKey);

function MissingClerkKey() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] p-8 text-center text-gray-700">
      <div className="max-w-lg space-y-3">
        <p className="font-semibold text-gray-900">Chave do Clerk inválida ou em falta</p>
        <p>
          Cola a <strong>Publishable key</strong> real no{' '}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">frontend/.env</code>:
        </p>
        <code className="block text-left text-sm bg-gray-100 p-3 rounded-lg break-all">
          VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
        </code>
        <p className="text-sm text-gray-600">
          Clerk Dashboard → Configure → API Keys. Depois reinicia o{' '}
          <code className="bg-gray-100 px-1 rounded">npm run dev</code> (o Vite só lê o .env ao
          arrancar).
        </p>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      {clerkKeyOk ? (
        <ClerkProvider publishableKey={publishableKey}>
          <App />
        </ClerkProvider>
      ) : (
        <MissingClerkKey />
      )}
    </ErrorBoundary>
  </React.StrictMode>,
);
