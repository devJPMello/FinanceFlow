import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate, formatDateTime } from './format';

describe('formatCurrency', () => {
  it('deve formatar valores monetários corretamente', () => {
    expect(formatCurrency(1000)).toMatch(/R\$\s*1\.000,00/);
    expect(formatCurrency(100.5)).toMatch(/R\$\s*100,50/);
    expect(formatCurrency(0)).toMatch(/R\$\s*0,00/);
  });

  it('deve formatar valores negativos', () => {
    expect(formatCurrency(-100)).toMatch(/-R\$\s*100,00/);
  });

  it('deve formatar valores decimais', () => {
    expect(formatCurrency(1234.56)).toMatch(/R\$\s*1\.234,56/);
  });
});

describe('formatDate', () => {
  it('deve formatar data string corretamente', () => {
    const dateStr = '2024-01-15T12:00:00Z';
    const formatted = formatDate(dateStr);
    expect(formatted).toMatch(/15\/01\/2024/);
  });

  it('deve formatar objeto Date corretamente', () => {
    const date = new Date('2024-12-25T12:00:00Z');
    const formatted = formatDate(date);
    expect(formatted).toMatch(/25\/12\/2024/);
  });

  it('deve formatar com zeros à esquerda', () => {
    const date = new Date('2024-01-05T12:00:00Z');
    const formatted = formatDate(date);
    expect(formatted).toMatch(/05\/01\/2024/);
  });

  it('deve retornar string no formato DD/MM/YYYY', () => {
    const date = new Date('2024-06-15T12:00:00Z');
    const formatted = formatDate(date);
    expect(formatted).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});

describe('formatDateTime', () => {
  it('deve formatar data e hora corretamente', () => {
    const date = new Date('2024-01-15T14:30:00');
    const formatted = formatDateTime(date);
    expect(formatted).toMatch(/15\/01\/2024/);
    expect(formatted).toMatch(/14:30/);
  });

  it('deve formatar string de data e hora', () => {
    const dateStr = '2024-12-25T10:15:00';
    const formatted = formatDateTime(dateStr);
    expect(formatted).toMatch(/25\/12\/2024/);
    expect(formatted).toMatch(/10:15/);
  });

  it('deve incluir minutos com zeros à esquerda', () => {
    const date = new Date('2024-01-15T09:05:00');
    const formatted = formatDateTime(date);
    expect(formatted).toMatch(/09:05/);
  });
});
