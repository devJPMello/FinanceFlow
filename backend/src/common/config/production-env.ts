/**
 * Falha cedo em produção se variáveis críticas faltarem (evita API a arrancar sem auth/BD).
 */
export function assertProductionEnv(): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  const required = ['DATABASE_URL', 'CLERK_SECRET_KEY'] as const;
  const missing = required.filter((k) => !process.env[k]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `[bootstrap] Produção: defina as variáveis obrigatórias: ${missing.join(', ')}`,
    );
  }
}
