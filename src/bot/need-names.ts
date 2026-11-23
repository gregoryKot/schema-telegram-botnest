// Копия shared/src/needs/needNames.ts: прод-код бэкенда не импортирует shared/ (rootDir src).
// Сверка с оригиналом — need-names.sync.spec.ts (правило №4).
export const NEED_NAMES: Readonly<Record<string, string>> = {
  attachment: 'Привязанность',
  autonomy: 'Автономия',
  expression: 'Выражение чувств',
  play: 'Спонтанность',
  limits: 'Самоконтроль',
};
