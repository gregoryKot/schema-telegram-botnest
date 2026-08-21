// Блок «Установка с сайта» для /stats (правило №8: событие, которого нет в
// отчёте, — невидимо). Три механики home_screen_offer, разведённые PR #399:
// баннер кабинета (авторизован, shown = развернул инструкцию) и лендинг
// (аноним, userId = null — shown не шлётся вообще, только add/added). Чистый
// форматтер, покрыт тестом, включая пустую БД. Язык — простой, без
// англицизмов (правило №8: «поделились», а не «share_card events»).

export interface SiteInstallMetrics {
  /** Баннер «приложение для телефона» в кабинете сайта (авторизованный путь). */
  banner: { shown30: number; add30: number; added30: number };
  /**
   * Блок установки на публичном лендинге. Анонимный источник (userId = null)
   * не шлёт shown вообще — только add/added, и то без верификации личности
   * (правило №5/№14): числам с лендинга доверяем ограниченно, это счётчик
   * кликов браузера, а не подтверждённых людей.
   */
  landing: { add30: number; added30: number };
}

const isEmpty = (m: SiteInstallMetrics): boolean =>
  m.banner.shown30 === 0 &&
  m.banner.add30 === 0 &&
  m.banner.added30 === 0 &&
  m.landing.add30 === 0 &&
  m.landing.added30 === 0;

/** Текстовый блок для /stats. Чистая функция. */
export function formatSiteInstallMetrics(m: SiteInstallMetrics): string {
  if (isEmpty(m)) {
    return '📲 <b>Установка с сайта</b>: за 30 дней никто не ставил.';
  }
  const lines = [`📲 <b>Установка с сайта</b> (за месяц)`];
  const { banner, landing } = m;
  if (banner.shown30 > 0 || banner.add30 > 0 || banner.added30 > 0) {
    lines.push(
      `Баннер в кабинете: развернули инструкцию ${banner.shown30} · ` +
        `нажали установить ${banner.add30} · поставили ${banner.added30}`,
    );
  }
  if (landing.add30 > 0 || landing.added30 > 0) {
    lines.push(
      `Лендинг: нажали установить ${landing.add30} · поставили ${landing.added30}`,
    );
  }
  return lines.join('\n');
}
