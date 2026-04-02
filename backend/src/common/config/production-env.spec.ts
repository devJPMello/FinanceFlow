import { assertProductionEnv } from './production-env';

describe('assertProductionEnv', () => {
  let nodeEnv: string | undefined;
  let databaseUrl: string | undefined;
  let clerkKey: string | undefined;

  beforeAll(() => {
    nodeEnv = process.env.NODE_ENV;
    databaseUrl = process.env.DATABASE_URL;
    clerkKey = process.env.CLERK_SECRET_KEY;
  });

  afterEach(() => {
    if (nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnv;
    if (databaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = databaseUrl;
    if (clerkKey === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = clerkKey;
  });

  it('não falha fora de produção', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DATABASE_URL;
    delete process.env.CLERK_SECRET_KEY;
    expect(() => assertProductionEnv()).not.toThrow();
  });

  it('em produção exige DATABASE_URL e CLERK_SECRET_KEY', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.DATABASE_URL;
    delete process.env.CLERK_SECRET_KEY;
    expect(() => assertProductionEnv()).toThrow(/DATABASE_URL/);

    process.env.DATABASE_URL = 'postgresql://x';
    expect(() => assertProductionEnv()).toThrow(/CLERK_SECRET_KEY/);

    process.env.CLERK_SECRET_KEY = 'sk_live_x';
    expect(() => assertProductionEnv()).not.toThrow();
  });
});
