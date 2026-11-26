export type SubscriptionOption = { period: 'month' | 'year'; price: number };

export const periodLabel = (p: string) => (p === 'year' ? 'год' : 'месяц');

// Скидка годового плана относительно 12 месячных платежей, в целых процентах.
// Считается только из цен API; нет обеих цен или выгоды нет — 0 (бейдж не рисуем).
export function yearDiscountPercent(opts: SubscriptionOption[]): number {
  const month = opts.find((o) => o.period === 'month')?.price;
  const year = opts.find((o) => o.period === 'year')?.price;
  if (!month || !year || month <= 0 || year <= 0) return 0;
  const full = month * 12;
  if (year >= full) return 0;
  return Math.round((1 - year / full) * 100);
}
