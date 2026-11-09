// Бакет для meta.section события client_error (волна 9, docs/SHIELD_PROMPT.md).
// `body.section` в POST /api/client-errors — литерал из JSX (`<ErrorBoundary section="…">`,
// `AUTH_FAILURE_SECTION`), но эндпоинт БЕЗ auth-гарда (client-errors.controller.ts) —
// значит прислать можно что угодно. Чтобы meta оставалась СТРУКТУРНОЙ (№7/№8:
// никакого свободного текста в аналитике), бакетим в ограниченный набор;
// всё незнакомое — в 'other'.
export const CLIENT_ERROR_SECTIONS = [
  'auth',
  'login',
  'today',
  'diary',
  'schemas',
  'practice',
  'profile',
  'help',
  'cabinet',
  'booking',
  'assets',
  'subscription',
  'other',
] as const;
export type ClientErrorSection = (typeof CLIENT_ERROR_SECTIONS)[number];

// Известные литералы сайта → канонический бакет (сверено грепом по webapp/src;
// ключи удалённого мини-аппа — для старых клиентов). Новый экран заведёт секцию
// не из списка — она осядет в 'other'; расширять список, когда 'other' в /stats
// станет заметной долей.
const KNOWN: Readonly<Record<string, ClientErrorSection>> = {
  auth: 'auth', // AUTH_FAILURE_SECTION, shared/src/host/authFailureReport.ts
  // Своя секция, а не 'auth': тот бакет заведён под инцидент 2026-08-08 как
  // единственный свидетель «подпись пустая, экран-тупик», и подмешивать к
  // нему сбои выписки билета значило бы сделать ту метрику тише, а не громче.
  'login.ticket': 'login', // LOGIN_TICKET_SECTION, shared/src/auth/useLoginTicket.ts
  'today.tasks': 'today', // webapp/src/sections/today/useTaskActions.ts
  'practice.tasks': 'practice', // webapp/src/sections/PracticeSection.tsx (useTaskActions)
  Сегодня: 'today', // старые клиенты
  Дневник: 'diary', // webapp/src/components/AppShell.tsx, DiariesOverlay.tsx
  Паттерны: 'schemas', // webapp/src (раздел «Паттерны»)
  Практика: 'practice', // webapp/src/components/AppShell.tsx
  Практики: 'practice', // старые клиенты
  Профиль: 'profile', // старые клиенты
  Помощь: 'help', // старые клиенты
  Кабинет: 'cabinet', // webapp/src/components/AppShell.tsx
  // 'today' — в момент флаша человек на главном экране; упавшие источники видны в тексте.
  'appshell.bootstrap': 'today', // webapp/src/components/appShell/useBootstrapLoad.ts
  'therapist.clients': 'cabinet', // оба TherapistClientSheet.tsx — сбой загрузки ростера
  addressForm: 'profile', // shared/src/settings/useAddressFormChoice.ts, оба AddressFormPicker.tsx
  tracker: 'today', // webapp/src/components/TrackerOverlay.tsx — сбой сохранения оценки (не-сетевой)
  // Сбой отправки заявки на запись (инцидент 2026-09-13): сервер видит только
  // те заявки, что до него дошли; сетевой отказ виден лишь отсюда.
  booking: 'booking', // webapp/src/components/bookingFailure.ts
  // Файл сборки не догрузился и повторы не помогли (инцидент 2026-11-04, #928).
  assets: 'assets', // webapp/public/asset-recovery.js
  subscription: 'subscription', // отмена не прошла: useSubscriptionCancel.ts
};

/** Чистая функция: сырой `section` → канонический бакет. */
export function classifyClientErrorSection(raw: string): ClientErrorSection {
  return KNOWN[raw.trim()] ?? 'other';
}
