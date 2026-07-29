// База API мини-аппа. Отдельным модулем, а не в apiClient: его импортирует и
// session.ts, а session.ts импортируется самим apiClient — общий низкоуровневый
// модуль разрывает цикл. Парный файл — webapp/src/utils/apiBase.ts (правило №3).
const rawBase = (import.meta.env.VITE_API_URL as string) ?? '';

export const BASE =
  rawBase && !rawBase.startsWith('http') ? `https://${rawBase}` : rawBase;
