import { normalizeRows, parseAmount, parseCsv, parseDate, parseOfx } from './parsers';

describe('parsers', () => {
  it('parseAmount lida com formato pt-BR e parênteses', () => {
    expect(parseAmount('R$ 1.234,56', ',')).toBe(1234.56);
    expect(parseAmount('-45,90', ',')).toBe(-45.9);
    expect(parseAmount('(10,00)', ',')).toBe(-10);
    expect(parseAmount('1,234.50', '.')).toBe(1234.5);
    expect(parseAmount('abc', ',')).toBeNull();
  });

  it('parseDate aceita DD/MM/YYYY, ISO e rejeita datas inexistentes', () => {
    expect(parseDate('05/03/2024', 'DD/MM/YYYY')).toBe('2024-03-05');
    expect(parseDate('2024-03-05', 'DD/MM/YYYY')).toBe('2024-03-05');
    expect(parseDate('31/02/2024', 'DD/MM/YYYY')).toBeNull();
  });

  it('parseCsv detecta ponto e vírgula e normaliza linhas', () => {
    const csv = Buffer.from('Data;Descrição;Valor\n05/03/2024;Mercado;-120,50\n06/03/2024;Salário;5000,00\n');
    const t = parseCsv(csv);
    expect(t.columns).toEqual(['Data', 'Descrição', 'Valor']);
    const rows = normalizeRows(t, { date: 'Data', description: 'Descrição', amount: 'Valor', dateFormat: 'DD/MM/YYYY', decimal: ',' });
    expect(rows[0]).toMatchObject({ date: '2024-03-05', amount: 120.5, type: 'EXPENSE' });
    expect(rows[1]).toMatchObject({ amount: 5000, type: 'INCOME' });
  });

  it('parseOfx extrai transações SGML sem tags de fechamento', () => {
    const ofx = Buffer.from(
      '<OFX><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20240305120000<TRNAMT>-50.00<FITID>A1<MEMO>PADARIA</STMTTRN></OFX>',
    );
    const t = parseOfx(ofx);
    expect(t.rows[0]).toEqual({ date: '2024-03-05', description: 'PADARIA', amount: '-50.00', fitid: 'A1' });
  });
});

describe('parseXls (planilha legada)', () => {
  it('lê cabeçalho e linhas de um .xls BIFF8', () => {
    const XLSX = require('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([['Data', 'Descrição', 'Valor'], ['01/11/2026', 'Mercado', '-50,00'], ['', '', ''], ['02/11/2026', 'Salário', '1000,00']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Extrato');
    const buf: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'biff8' });
    const t = require('./parsers').parseXls(buf);
    expect(t.columns).toEqual(['Data', 'Descrição', 'Valor']);
    expect(t.rows).toHaveLength(2);
    expect(t.rows[1]).toEqual({ Data: '02/11/2026', Descrição: 'Salário', Valor: '1000,00' });
  });
});
