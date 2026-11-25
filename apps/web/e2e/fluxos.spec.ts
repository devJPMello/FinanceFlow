import { expect, Page, test } from '@playwright/test';
import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const API = process.env.E2E_API_URL ?? 'http://localhost:3000/api';
const email = `pw-${Date.now()}@e2e.test`;
const password = 'senha12345';

test.describe.configure({ mode: 'serial' });

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: /Bom dia|Boa tarde|Boa noite/ })).toBeVisible();
}

test.afterAll(async ({ request }) => {
  // apaga o usuário de teste (e todos os dados dele)
  const r = await request.post(`${API}/auth/login`, { data: { email, password } });
  if (r.ok()) {
    const { accessToken } = await r.json();
    await request.delete(`${API}/auth/me`, { headers: { Authorization: `Bearer ${accessToken}` }, data: { password } });
  }
});

test('cadastro leva ao dashboard e o logout volta ao login', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Nome').fill('Playwright');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.getByRole('heading', { name: /Bom dia|Boa tarde|Boa noite/ })).toBeVisible();
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login/);
});

test('login com senha errada mostra erro', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('senha-errada');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toContainText('Credenciais inválidas');
});

test('cria transação com forma de pagamento Pix e filtra por ela', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Transações' }).click();
  const dialog = page.getByRole('dialog');
  const add = async (valor: string, descricao: string, forma: string) => {
    await page.getByRole('button', { name: 'Nova transação' }).first().click();
    await dialog.getByLabel('Valor (R$)').fill(valor);
    await dialog.getByLabel('Descrição').fill(descricao);
    await dialog.getByLabel('Forma de pagamento').selectOption(forma);
    await dialog.getByRole('button', { name: 'Salvar' }).click();
    await expect(dialog).toBeHidden();
  };
  await add('42.50', 'Almoço Pix', 'PIX');
  await add('10', 'Café crédito', 'CREDIT');

  await expect(page.getByText('Almoço Pix').first()).toBeVisible();
  await expect(page.getByRole('table').getByText('Pix', { exact: true })).toBeVisible();

  await page.getByLabel('Forma de pagamento').selectOption('PIX');
  await expect(page.getByText('Almoço Pix').first()).toBeVisible();
  await expect(page.getByText('Café crédito')).toHaveCount(0);
});

test('cria regra de categorização', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Regras' }).click();
  await page.getByPlaceholder(/uber/i).fill('almoço');
  await page.getByLabel('Categorizar como').selectOption({ label: 'Alimentação (despesa)' });
  await page.getByRole('button', { name: 'Criar' }).click();
  await expect(page.getByText('Regra criada')).toBeVisible();
  await page.getByRole('button', { name: 'Aplicar às sem categoria' }).click();
  await expect(page.getByText(/categorizada/)).toBeVisible();
});

test('importa um CSV pelo assistente', async ({ page }) => {
  const file = join(tmpdir(), 'extrato-e2e.csv');
  writeFileSync(file, 'Data;Descrição;Valor\n01/11/2026;Padaria;-12,50\n02/11/2026;Freela;300,00\n');
  await login(page);
  await page.getByRole('link', { name: 'Importar planilha' }).click();
  await page.locator('input[type=file]').setInputFiles(file);
  await page.getByLabel('Conta de destino').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Processar' }).click();
  await page.getByRole('button', { name: /Importar 2 transações/ }).click();
  await expect(page.getByText('2 transações importadas!')).toBeVisible();
});

test('altera o nome nas configurações', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Configurações' }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Nome Atualizado');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Perfil atualizado')).toBeVisible();
});

test('recuperar senha mostra confirmação sem revelar se o e-mail existe', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Esqueci minha senha' }).click();
  await page.getByLabel('E-mail').fill('desconhecido@e2e.test');
  await page.getByRole('button', { name: 'Enviar link' }).click();
  await expect(page.getByRole('status')).toContainText('Pedido enviado');
});
