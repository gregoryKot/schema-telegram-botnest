// Русское склонение числительных. Одна копия на все отчёты: до этого `plural`
// жил в account-link-metrics.format.ts, а `times` — в money-metrics.format.ts,
// и третья копия сделала бы расхождение вопросом времени (правило «одна
// механика — один компонент»).
export function plural(
  n: number,
  one: string,
  few: string,
  many: string,
): string {
  const mod100 = Math.abs(n) % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = mod100 % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
