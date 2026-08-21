// Реестр UI-флагов User, которые клиент читает/пишет через
// GET/POST /api/user-flags (см. api.controller.ts) — единственный источник
// правды. Вынесен в отдельный файл, чтобы merge.service (merge-user-fields.ts)
// мог перенести те же поля между аккаунтами без копии списка (правило №4:
// денормализация/дублированные реестры — только с тестом-сверкой; здесь вместо
// теста — сам факт одного файла-источника).
//
// `therapistMode` НАМЕРЕННО отсутствует — это де-факто флаг «терапевтический
// UI», выставляется сервером из `role` (см. account.service.setRole).
// Позволить клиенту его переключать — это эскалация привилегий в
// терапевтический UI; merge переносит его вместе с role отдельной веткой
// (см. merge-user-fields.ts), не через этот реестр.
export const FLAG_FIELDS = [
  'themePref',
  'onboardingV1Done',
  'onboardingV2Done',
  'onboardingSkipped',
  'childhoodWheelDone',
  'ysqBannerDismissed',
  'hintSheetCloseShown',
  'hintHistoryDismissed',
  'trackerOnboardingDone',
  'lastCelebrationDate',
  'lastYesterdayBannerDate',
  'lastWeeklyQuestionWeek',
  'schemaIntrosShown',
  'modeIntrosShown',
  'defaultSection',
] as const;
