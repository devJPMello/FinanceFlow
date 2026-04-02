/**
 * Período alinhado ao dashboard: ano selecionado = ano civil atual → mês atual;
 * outros anos → dezembro (visão anual do gráfico).
 */
export function dashboardFocusMonth(year: number): string {
  const now = new Date();
  if (year === now.getFullYear()) {
    return `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  return `${year}-12`;
}

const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidMonthKey(s: string | null | undefined): s is string {
  return !!s && MONTH_KEY_RE.test(s);
}

/** Limites do mês em data local (inputs type="date"). */
export function monthKeyToDateRangeLocal(monthKey: string): { startDate: string; endDate: string } {
  const [ys, ms] = monthKey.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { startDate: fmt(start), endDate: fmt(end) };
}

/** Rótulo curto para UI (ex.: "abril de 2026"). */
export function formatMonthKeyPt(monthKey: string): string {
  const [ys, ms] = monthKey.split('-');
  const y = Number(ys);
  const m = Number(ms);
  if (!y || m < 1 || m > 12) return monthKey;
  const names = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ];
  return `${names[m - 1]} de ${y}`;
}
