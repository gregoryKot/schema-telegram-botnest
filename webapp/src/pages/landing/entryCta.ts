// Куда ведёт главная кнопка лендинга. Залогиненный человек тоже видит
// главную (раньше его молча уводило на /today) — и ему нужна дверь в
// приложение, а не «Войти». Для гостя — «Начать»: без «бесплатно», оно
// читалось как «потом будет платно».
export type EntryCta = { href: string; nav: string; main: string };

export function entryCta(isAuthenticated: boolean): EntryCta {
  return isAuthenticated
    ? { href: '/today', nav: 'В приложение', main: 'Перейти в приложение →' }
    : { href: '/login', nav: 'Войти', main: 'Начать →' };
}
