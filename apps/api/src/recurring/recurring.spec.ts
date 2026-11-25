import { ruleMatches } from '../categories/categories.module';
import { addMonthsIso } from '../transactions/transactions.module';
import { occurrence } from './recurring.module';

describe('datas recorrentes', () => {
  it('mantém o dia e ajusta para o fim do mês', () => {
    expect(addMonthsIso(new Date('2026-01-31'), 1)).toBe('2026-02-28');
    expect(addMonthsIso(new Date('2026-11-30'), 3)).toBe('2027-02-28');
  });
  it('ancora as ocorrências na data inicial (sem acumular desvio)', () => {
    const start = new Date('2026-01-31');
    expect(occurrence(start, 'MONTHLY', 1).toISOString().slice(0, 10)).toBe('2026-02-28');
    expect(occurrence(start, 'MONTHLY', 2).toISOString().slice(0, 10)).toBe('2026-03-31');
    expect(occurrence(start, 'WEEKLY', 2).toISOString().slice(0, 10)).toBe('2026-02-14');
    expect(occurrence(start, 'YEARLY', 1).toISOString().slice(0, 10)).toBe('2027-01-31');
  });
});

describe('regras de categorização', () => {
  it('contém ignora maiúsculas', () => expect(ruleMatches({ pattern: 'uber', matchType: 'CONTAINS' }, 'UBER *TRIP')).toBe(true));
  it('regex válida e inválida', () => {
    expect(ruleMatches({ pattern: '^pix[ ]', matchType: 'REGEX' }, 'PIX recebido')).toBe(true);
    expect(ruleMatches({ pattern: '(', matchType: 'REGEX' }, 'qualquer')).toBe(false);
  });
});
