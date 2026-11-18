// Боковое оглавление листа «Настройки»: порядок строк = порядок групп листа (SettingsSheet.tsx;
// сверка «оглавление совпадает с разделами» — SettingsSheet.test.tsx). Порядок по смыслу (b25):
// кто я и как со мной говорить → приложение → люди → о приложении → данные с опасными действиями.
export interface SettingsNavItem { id: string; label: string; find: string } // find — что внутри раздела: по нему ищет общий поиск

export function settingsNav({ therapist, modeSwitch, homeIcon }: {
  therapist: boolean; // роль специалиста: «Кабинет» вместо «Мой терапевт», заявки «Специалист» нет
  /** Есть переключатель «Клиент · Терапевт» (первая группа «Режим»). */
  modeSwitch: boolean;
  /** Показывается группа «Значок на экране» (homeIconMode() не null). */
  homeIcon: boolean;
}): SettingsNavItem[] {
  return [
    ...(modeSwitch ? [{ id: 's-mode', label: 'Режим', find: 'Клиент или терапевт, кабинет' }] : []),
    { id: 's-name', label: 'Имя', find: 'Имя в приложении' },
    { id: 's-address', label: 'Обращение', find: 'На «ты» или на «вы»' },
    { id: 's-notifications', label: 'Уведомления', find: 'Напоминания, итоги дня, время, частота, тихие часы, часовой пояс' },
    { id: 's-appearance', label: 'Оформление', find: 'Меньше движения, анимация' },
    ...(homeIcon ? [{ id: 's-home', label: 'Значок на экране', find: 'Установить приложение' }] : []),
    therapist ? { id: 's-cabinet', label: 'Кабинет', find: 'Открыть кабинет терапевта' }
      : { id: 's-therapist', label: 'Мой терапевт', find: 'Код от терапевта, доступ к карточкам и профилю' },
    { id: 's-partner', label: 'Партнёр', find: 'Приглашение в пару, вход по коду' },
    { id: 's-share', label: 'Поделиться', find: 'Пригласить друга, сводка для терапевта' },
    ...(therapist ? [] : [{ id: 's-specialist', label: 'Специалист', find: 'Стать специалистом, заявка' }]),
    { id: 's-about', label: 'О приложении', find: 'Зачем это всё, пять потребностей, об авторе' },
    { id: 's-data', label: 'Данные', find: 'Конфиденциальность, скачать мои данные, удалить аккаунт' },
  ];
}
