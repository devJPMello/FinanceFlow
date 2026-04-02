import { test, expect } from '@playwright/test';

/**
 * Smoke E2E — correm no CI contra `vite preview` (build sem sessão Clerk válida é aceite:
 * a app mostra aviso de chave ou ecrã de sign-in; o importante é não haver crash).
 *
 * Fluxo **com login Clerk** em local: subir `npm run dev`, definir `E2E_CLERK_EMAIL` e
 * `E2E_CLERK_PASSWORD` e estender estes testes (UI do Clerk varia por tema/idioma).
 */
test.describe('Smoke', () => {
  test('app carrega e o documento está visível', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });

  test('rota /sign-in responde', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveURL(/sign-in/);
  });

  test('rotas principais da SPA respondem sem crash (sem sessão Clerk)', async ({ page }) => {
    for (const path of ['/transactions', '/dashboard', '/categories', '/goals', '/tax-vision']) {
      await page.goto(path);
      await expect(page.locator('body')).toBeVisible();
    }
  });
});
