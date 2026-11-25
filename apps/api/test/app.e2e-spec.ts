import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { MailService } from '../src/auth/mail.service';
import { TEST_DB_URL } from './env';

const sent: { to: string; text: string }[] = [];
let app: INestApplication;
let db: PrismaClient;
const http = () => request(app.getHttpServer());
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function signup(email: string, name = 'Teste') {
  const r = await http().post('/api/auth/register').send({ name, email, password: 'senha12345' }).expect(201);
  const h = auth(r.body.accessToken);
  const accounts = (await http().get('/api/accounts').set(h)).body;
  const categories = (await http().get('/api/categories').set(h)).body;
  return { token: r.body.accessToken as string, refresh: r.body.refreshToken as string, h, accountId: accounts[0].id as string, categories };
}
type User = Awaited<ReturnType<typeof signup>>;
const cat = (u: User, name: string) => u.categories.find((c: { name: string }) => c.name === name).id as string;

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue({ send: async (to: string, _s: string, text: string) => { sent.push({ to, text }); } })
    .compile();
  app = mod.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();
  db = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
  await db.user.deleteMany({ where: { email: { endsWith: '@e2e.test' } } });
});

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { endsWith: '@e2e.test' } } });
  await db.$disconnect();
  await app.close();
});

describe('autenticação', () => {
  it('exige token nas rotas privadas', () => http().get('/api/transactions').expect(401));

  it('registra, cria categorias padrão, faz login e rotaciona o refresh token', async () => {
    const u = await signup('auth@e2e.test');
    expect(u.categories.length).toBeGreaterThan(5);
    await http().post('/api/auth/register').send({ name: 'Dup', email: 'AUTH@e2e.test', password: 'senha12345' }).expect(409);
    await http().post('/api/auth/login').send({ email: 'auth@e2e.test', password: 'errada' }).expect(401);
    await http().post('/api/auth/login').send({ email: 'auth@e2e.test', password: 'senha12345' }).expect(200);
    const r1 = await http().post('/api/auth/refresh').send({ refreshToken: u.refresh }).expect(200);
    expect(r1.body.refreshToken).not.toBe(u.refresh);
    await http().post('/api/auth/refresh').send({ refreshToken: u.refresh }).expect(401); // já usado
  });

  it('recupera a senha por e-mail com token de uso único', async () => {
    await signup('reset@e2e.test');
    await http().post('/api/auth/forgot-password').send({ email: 'ninguem@e2e.test' }).expect(204); // não revela se existe
    expect(sent.find((m) => m.to === 'ninguem@e2e.test')).toBeUndefined();
    await http().post('/api/auth/forgot-password').send({ email: 'reset@e2e.test' }).expect(204);
    const token = sent.find((m) => m.to === 'reset@e2e.test')!.text.match(/token=([a-f0-9]+)/)![1];
    await http().post('/api/auth/reset-password').send({ token: 'a'.repeat(64), newPassword: 'novasenha123' }).expect(400);
    await http().post('/api/auth/reset-password').send({ token, newPassword: 'novasenha123' }).expect(204);
    await http().post('/api/auth/reset-password').send({ token, newPassword: 'outrasenha123' }).expect(400); // uso único
    await http().post('/api/auth/login').send({ email: 'reset@e2e.test', password: 'senha12345' }).expect(401);
    await http().post('/api/auth/login').send({ email: 'reset@e2e.test', password: 'novasenha123' }).expect(200);
  });

  it('perfil: altera nome, troca senha e exclui a conta', async () => {
    const u = await signup('perfil@e2e.test');
    const me = await http().patch('/api/auth/me').set(u.h).send({ name: 'Novo Nome' }).expect(200);
    expect(me.body.name).toBe('Novo Nome');
    await http().post('/api/auth/change-password').set(u.h).send({ currentPassword: 'x', newPassword: 'novasenha123' }).expect(400);
    await http().post('/api/auth/change-password').set(u.h).send({ currentPassword: 'senha12345', newPassword: 'novasenha123' }).expect(204);
    await http().delete('/api/auth/me').set(u.h).send({ password: 'errada' }).expect(400);
    await http().delete('/api/auth/me').set(u.h).send({ password: 'novasenha123' }).expect(204);
    await http().post('/api/auth/login').send({ email: 'perfil@e2e.test', password: 'novasenha123' }).expect(401);
  });
});

describe('transações', () => {
  it('cria com forma de pagamento e tags, filtra e exporta', async () => {
    const u = await signup('tx@e2e.test');
    const base = { accountId: u.accountId, type: 'EXPENSE', date: '2026-11-10' };
    await http().post('/api/transactions').set(u.h).send({ ...base, amount: 50, description: 'Mercado', paymentMethod: 'PIX', tags: ['casa'] }).expect(201);
    await http().post('/api/transactions').set(u.h).send({ ...base, amount: 30, description: 'Cinema', paymentMethod: 'CREDIT' }).expect(201);
    await http().post('/api/transactions').set(u.h).send({ ...base, amount: 10, description: 'Sem forma', paymentMethod: '' }).expect(201);
    await http().post('/api/transactions').set(u.h).send({ ...base, amount: 10, description: 'Inválida', paymentMethod: 'BOLETO' }).expect(400);

    const pix = await http().get('/api/transactions?paymentMethod=PIX').set(u.h).expect(200);
    expect(pix.body.items.map((t: { description: string }) => t.description)).toEqual(['Mercado']);
    expect(pix.body.totals.expense).toBe(50);
    expect((await http().get('/api/transactions?tag=casa').set(u.h)).body.total).toBe(1);
    const csv = await http().get('/api/transactions/export.csv').set(u.h);
    expect(csv.text).toContain('pagamento');
    expect(csv.text).toContain('PIX');
  });

  it('gera parcelas mensais', async () => {
    const u = await signup('parcelas@e2e.test');
    const r = await http().post('/api/transactions').set(u.h)
      .send({ accountId: u.accountId, type: 'EXPENSE', amount: 100, date: '2026-01-31', description: 'TV', installments: 3, paymentMethod: 'CREDIT' }).expect(201);
    expect(r.body.created).toBe(3);
    const list = await http().get('/api/transactions?q=TV').set(u.h);
    const dates = list.body.items.map((t: { date: string }) => t.date.slice(0, 10)).sort();
    expect(dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    expect(list.body.items.every((t: { paymentMethod: string }) => t.paymentMethod === 'CREDIT')).toBe(true);
  });

  it('isola os dados entre usuários', async () => {
    const a = await signup('iso-a@e2e.test');
    const b = await signup('iso-b@e2e.test');
    const tx = await http().post('/api/transactions').set(a.h).send({ accountId: a.accountId, type: 'EXPENSE', amount: 5, date: '2026-11-01', description: 'Privada' }).expect(201);
    expect((await http().get('/api/transactions').set(b.h)).body.total).toBe(0);
    await http().put(`/api/transactions/${tx.body.id}`).set(b.h).send({ accountId: b.accountId, type: 'EXPENSE', amount: 1, date: '2026-11-01', description: 'x' }).expect(404);
    await http().delete(`/api/transactions/${tx.body.id}`).set(b.h).expect(404);
    await http().post('/api/transactions').set(b.h).send({ accountId: a.accountId, type: 'EXPENSE', amount: 1, date: '2026-11-01', description: 'x' }).expect(404);
  });

  it('anexa, baixa e remove comprovantes (e rejeita tipos inválidos)', async () => {
    const u = await signup('anexo@e2e.test');
    const tx = await http().post('/api/transactions').set(u.h).send({ accountId: u.accountId, type: 'EXPENSE', amount: 5, date: '2026-11-01', description: 'Com anexo' });
    const url = `/api/transactions/${tx.body.id}/attachments`;
    const up = await http().post(url).set(u.h).attach('file', Buffer.from('%PDF-1.4 teste'), { filename: 'nota.pdf', contentType: 'application/pdf' }).expect(201);
    await http().post(url).set(u.h).attach('file', Buffer.from('oi'), { filename: 'a.txt', contentType: 'text/plain' }).expect(400);
    const dl = await http().get(`/api/attachments/${up.body.id}/download`).set(u.h).expect(200);
    expect(dl.headers['content-disposition']).toContain('nota.pdf');
    const other = await signup('anexo-b@e2e.test');
    await http().get(`/api/attachments/${up.body.id}/download`).set(other.h).expect(404);
    await http().delete(`/api/attachments/${up.body.id}`).set(u.h).expect(200);
  });
});

describe('regras, recorrentes e orçamentos', () => {
  it('aplica regras às transações sem categoria', async () => {
    const u = await signup('regras@e2e.test');
    await http().post('/api/transactions').set(u.h).send({ accountId: u.accountId, type: 'EXPENSE', amount: 20, date: '2026-11-02', description: 'UBER *TRIP' });
    await http().post('/api/category-rules').set(u.h).send({ pattern: '(', matchType: 'REGEX', categoryId: cat(u, 'Transporte') }).expect(400);
    await http().post('/api/category-rules').set(u.h).send({ pattern: 'uber', categoryId: cat(u, 'Transporte') }).expect(201);
    const r = await http().post('/api/category-rules/apply').set(u.h).expect(200);
    expect(r.body.updated).toBe(1);
    const list = await http().get('/api/transactions').set(u.h);
    expect(list.body.items[0].category.name).toBe('Transporte');
  });

  it('lança recorrências atrasadas uma única vez', async () => {
    const u = await signup('recorrente@e2e.test');
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth() - 2);
    await http().post('/api/recurring').set(u.h)
      .send({ accountId: u.accountId, type: 'EXPENSE', amount: 40, description: 'Streaming', frequency: 'MONTHLY', startDate: start.toISOString().slice(0, 10), paymentMethod: 'CREDIT' }).expect(201);
    expect((await http().get('/api/transactions').set(u.h)).body.total).toBe(3);
    const again = await http().post('/api/recurring/run').set(u.h).expect(200);
    expect(again.body.created).toBe(0);
    expect((await http().get('/api/transactions').set(u.h)).body.total).toBe(3);
  });

  it('alerta quando o orçamento passa de 80%', async () => {
    const u = await signup('orcamento@e2e.test');
    const month = '2026-11';
    const spend = (amount: number, date: string, description: string) =>
      http().post('/api/transactions').set(u.h).send({ accountId: u.accountId, categoryId: cat(u, 'Lazer'), type: 'EXPENSE', amount, date, description }).expect(201);
    await http().post('/api/budgets').set(u.h).send({ categoryId: cat(u, 'Lazer'), month, amount: 100 }).expect(201);
    await spend(85, '2026-11-05', 'Show');
    let alerts = (await http().get(`/api/budgets/alerts?month=${month}`).set(u.h)).body;
    expect(alerts).toHaveLength(1);
    expect(alerts[0].level).toBe('warning');
    await spend(30, '2026-11-06', 'Bar');
    alerts = (await http().get(`/api/budgets/alerts?month=${month}`).set(u.h)).body;
    expect(alerts[0].level).toBe('danger');
  });
});

describe('importação', () => {
  const csv = 'Data;Descrição;Valor\n01/11/2026;Mercado;-50,00\n02/11/2026;Salário;1000,00\n';
  const mapping = { date: 'Data', description: 'Descrição', amount: 'Valor', dateFormat: 'DD/MM/YYYY', decimal: ',' };

  async function upload(u: User) {
    const up = await http().post('/api/imports').set(u.h).attach('file', Buffer.from(csv), 'extrato.csv').expect(201);
    expect(up.body.columns).toEqual(['Data', 'Descrição', 'Valor']);
    return up.body.id as string;
  }

  it('importa CSV, confirma, e marca a reimportação como duplicada', async () => {
    const u = await signup('import@e2e.test');
    const id = await upload(u);
    const prev = await http().post(`/api/imports/${id}/mapping`).set(u.h).send({ accountId: u.accountId, mapping }).expect(201);
    expect(prev.body.counts.pending).toBe(2);
    const done = await http().post(`/api/imports/${id}/confirm`).set(u.h).expect(201);
    expect(done.body.imported).toBe(2);
    expect((await http().get('/api/transactions').set(u.h)).body.total).toBe(2);

    const id2 = await upload(u);
    const prev2 = await http().post(`/api/imports/${id2}/mapping`).set(u.h).send({ accountId: u.accountId, mapping }).expect(201);
    expect(prev2.body.counts.duplicate).toBe(2);

    await http().delete(`/api/imports/${id}`).set(u.h).expect(200); // desfaz o lote
    expect((await http().get('/api/transactions').set(u.h)).body.total).toBe(0);
  });

  it('rejeita formato não suportado', async () => {
    const u = await signup('import2@e2e.test');
    await http().post('/api/imports').set(u.h).attach('file', Buffer.from('x'), 'foto.png').expect(400);
  });
});
