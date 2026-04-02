import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ClerkAuthGuard } from '../src/auth/clerk-auth.guard';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Critical flows (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userId = 'e2e-user';
  let expenseCategoryId = '';
  let createdTransactionId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(ClerkAuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = { id: userId, email: 'e2e@financeflow.local', name: 'E2E User' };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.$executeRawUnsafe(
      `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "userNote" TEXT`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "async_jobs" ADD COLUMN IF NOT EXISTS "durationMs" INTEGER`,
    );
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "import_metrics" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "source" TEXT NOT NULL,
        "success" BOOLEAN NOT NULL,
        "durationMs" INTEGER NOT NULL DEFAULT 0,
        "meta" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "import_metrics_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "user_suggestion_dismissals" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "key" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "user_suggestion_dismissals_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "user_suggestion_dismissals_userId_key_key" ON "user_suggestion_dismissals"("userId", "key")`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "import_metrics_userId_createdAt_idx" ON "import_metrics"("userId", "createdAt")`,
    );

    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email: 'e2e@financeflow.local', name: 'E2E User' },
    });
    const category = await prisma.category.create({
      data: { userId, name: 'E2E Despesa', type: 'EXPENSE' },
    });
    expenseCategoryId = category.id;
  });

  afterAll(async () => {
    await prisma.transactionAttachment.deleteMany({ where: { transaction: { userId } } });
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.category.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
  });

  it('creates transaction', async () => {
    const res = await request(app.getHttpServer())
      .post('/transactions')
      .send({
        type: 'EXPENSE',
        amount: 99.9,
        description: 'Compra teste e2e',
        date: new Date().toISOString(),
        categoryId: expenseCategoryId,
      })
      .expect(201);
    createdTransactionId = res.body.id;
    expect(createdTransactionId).toBeTruthy();
  });

  it('imports ai extract endpoint responds (400/502)', async () => {
    const res = await request(app.getHttpServer())
      .post('/transactions/import/ai')
      .attach('file', Buffer.from('date,amount\n2026-01-01,10'), 'sample.csv');
    expect([400, 502, 201]).toContain(res.statusCode);
  });

  it('uploads attachment', async () => {
    const png = Buffer.from(
      '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C6360000002000154A24F5D0000000049454E44AE426082',
      'hex',
    );
    const res = await request(app.getHttpServer())
      .post(`/transactions/${createdTransactionId}/attachments`)
      .attach('file', png, 'tiny.png');
    expect([201, 200]).toContain(res.statusCode);
  });

  it('marks IR and exports report', async () => {
    await request(app.getHttpServer())
      .post('/ai-insights/taxvision/classification-decision')
      .send({ transactionId: createdTransactionId, decision: 'accept' })
      .expect(201);

    const csv = await request(app.getHttpServer())
      .get('/ai-insights/taxvision/audit-report.csv')
      .expect(200);
    expect(String(csv.text || '')).toContain('Ano');
  });
});
