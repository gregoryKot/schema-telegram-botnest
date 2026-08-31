// Бакет для meta.section события client_error (волна 9 щита покрытия, см.
// docs/SHIELD_PROMPT.md). `body.section` в POST /api/client-errors — литерал,
// который разработчик задаёт в JSX (`<ErrorBoundary section="…">`,
// `AUTH_FAILURE_SECTION`), но эндпоинт БЕЗ auth-гарда (client-errors.controller.ts) —
// значит теоретически прислать можно что угодно. Чтобы meta оставалась
// СТРУКТУРНОЙ (правило №7/№8: никакого свободного текста в аналитике), а не
// произвольной строкой с клиента, бакетим в канонический ограниченный набор;
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
  'other',
] as const;
export type ClientErrorSection = (typeof CLIENT_ERROR_SECTIONS)[number];

// Известные литералы обоих фронтендов → канонический бакет (сверено грепом
// по webapp/src и schema-miniapp/src). Новый экран заведёт секцию не из
// списка — она осядет в 'other', просто не разложится дальше; расширять
// список стоит, когда 'other' в /stats станет заметной долей.
const KNOWN: Readonly<Record<string, ClientErrorSection>> = {
  auth: 'auth', // AUTH_FAILURE_SECTION, shared/src/host/authFailureReport.ts
  // Своя секция, а не 'auth': тот бакет заведён под инцидент 2026-08-08 как
  // единственный свидетель «подпись пустая, экран-тупик», и подмешивать к
  // нему сбои выписки билета значило бы сделать ту метрику тише, а не громче.
  'login.ticket': 'login', // LOGIN_TICKET_SECTION, shared/src/auth/useLoginTicket.ts
  'today.tasks': 'today', // webapp/src/sections/today/useTaskActions.ts
  'practice.tasks': 'practice', // webapp/src/sections/PracticeSection.tsx (useTaskActions)
  Сегодня: 'today', // schema-miniapp/src/components/AppSections.tsx
  Дневник: 'diary', // webapp/src/components/AppShell.tsx, DiariesOverlay.tsx
  Паттерны: 'schemas', // оба фронтенда
  Практика: 'practice', // webapp/src/components/AppShell.tsx
  Практики: 'practice', // schema-miniapp (тесты ErrorBoundary)
  Профиль: 'profile', // schema-miniapp/src/components/AppSections.tsx
  Помощь: 'help', // schema-miniapp/src/components/AppSections.tsx
  Кабинет: 'cabinet', // webapp/src/components/AppShell.tsx
  // 'today' — в момент флаша человек на главном экране; упавшие источники видны в тексте.
  'appshell.bootstrap': 'today', // webapp/src/components/appShell/useBootstrapLoad.ts
  'therapist.clients': 'cabinet', // оба TherapistClientSheet.tsx — сбой загрузки ростера
  addressForm: 'profile', // shared/src/settings/useAddressFormChoice.ts, оба AddressFormPicker.tsx
  tracker: 'today', // webapp/src/components/TrackerOverlay.tsx — сбой сохранения оценки (не-сетевой)
};

/** Чистая функция: сырой `section` → канонический бакет. */
export function classifyClientErrorSection(raw: string): ClientErrorSection {
  return KNOWN[raw.trim()] ?? 'other';
}
