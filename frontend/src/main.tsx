import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import * as Sentry from '@sentry/react';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import MissingClerkKey from './components/MissingClerkKey';
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
