import { useAuth } from '@clerk/clerk-react';
import { configureApiAuth } from '../lib/api';

/**
 * Garante que o axios já tem getToken configurado no mesmo render em que as
 * rotas protegidas montam — evita rajadas de pedidos sem Bearer e re-tentativas.
 */
export default function ClerkApiBridge({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded } = useAuth();

  if (isLoaded) {
    configureApiAuth(() => getToken());
  }

  return <>{children}</>;
}
