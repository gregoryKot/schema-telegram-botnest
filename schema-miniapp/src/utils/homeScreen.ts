import { miniappDeepLink } from './botConfig';

export * from '../../../shared/src/host/homeScreen';

// Ссылка «добавить на экран» — ровно та, которую строит сам Telegram-iOS в
// нативном addToHomeScreen (WebAppController.swift:
// t.me/<bot>/<app>?startapp&addToHomeScreen). Открытая в браузере, страница
// t.me ведёт человека по добавлению значка.
export function addToHomeScreenUrl(): string {
  return `${miniappDeepLink()}?startapp&addToHomeScreen`;
}
