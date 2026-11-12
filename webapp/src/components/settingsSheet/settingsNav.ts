// Боковое оглавление листа «Настройки»: порядок строк = порядок групп листа (SettingsSheet.tsx;
// сверка «оглавление совпадает с разделами» — SettingsSheet.test.tsx). Порядок по смыслу (b25):
// кто я и как со мной говорить → приложение → люди → о приложении → данные с опасными действиями.
export interface SettingsNavItem { id: string; label: string }

export function settingsNav({ therapist, modeSwitch, homeIcon }: {
  /** Роль специалиста: «Кабинет» вместо «Мой терапевт», заявки «Специалист» нет. */
  therapist: boolean;
  /** Есть переключатель «Клиент · Терапевт» (первая группа «Режим»). */
  modeSwitch: boolean;
  /** Показывается группа «Значок на экране» (homeIconMode() не null). */
  homeIcon: boolean;
}): SettingsNavItem[] {
  return [
    ...(modeSwitch ? [{ id: 's-mode', label: 'Режим' }] : []),
    { id: 's-name', label: 'Имя' },
    { id: 's-address', label: 'Обращение' }, // раздел был, строки в оглавлении не было (QA 2026-11, М10)
    { id: 's-notifications', label: 'Уведомления' },
    { id: 's-appearance', label: 'Оформление' },
    ...(homeIcon ? [{ id: 's-home', label: 'Значок на экране' }] : []),
    therapist ? { id: 's-cabinet', label: 'Кабинет' } : { id: 's-therapist', label: 'Мой терапевт' },
    { id: 's-partner', label: 'Партнёр' },
    { id: 's-share', label: 'Поделиться' },
    ...(therapist ? [] : [{ id: 's-specialist', label: 'Специалист' }]),
    { id: 's-about', label: 'О приложении' },
    { id: 's-data', label: 'Данные' },
  ];
}
