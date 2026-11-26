import { getHost } from './index';

// Предложение «поставить приложение на экран» внутри мессенджера. Ярлык
// мини-аппа Telegram нам не нужен: он привязан к Telegram. Вместо него кнопка
// открывает наш сайт (/install) во внешнем браузере, где ставится настоящее
// PWA. Предложение не зависит от API мессенджера — только от платформы.

// Значения window.Telegram.WebApp.platform: 'android' | 'android_x' | 'ios' |
// 'macos' | 'tdesktop' | 'weba' | 'webk' | 'unknown'.
export type HomeScreenPlatform = 'android' | 'ios' | 'other';

const PLATFORMS: Record<string, HomeScreenPlatform> = {
  android: 'android',
  android_x: 'android',
  ios: 'ios',
};

export function homeScreenPlatform(
  platform: string | undefined,
): HomeScreenPlatform {
  return (platform && PLATFORMS[platform]) || 'other';
}

export function canOfferHomeScreen(
  hostId: string,
  platform: string | undefined,
): boolean {
  return hostId !== 'web' && homeScreenPlatform(platform) !== 'other';
}

export function canOfferHomeScreenNow(): boolean {
  const host = getHost();
  return canOfferHomeScreen(host.id, host.platform);
}

export const INSTALL_PAGE_PATH = '/install';

/**
 * Адрес страницы установки. Код передачи сессии лежит во ФРАГМЕНТЕ, не в
 * query: фрагмент не уходит на сервер, поэтому не попадает ни в его логи, ни в
 * Referer.
 */
export function installPageUrl(handoffCode?: string): string {
  const origin = globalThis.location?.origin || 'https://schemehappens.ru';
  return `${origin}${INSTALL_PAGE_PATH}${handoffCode ? `#h=${handoffCode}` : ''}`;
}

// ── Память предложения ──────────────────────────────────────────────────────
// «Не предлагать» и «уже добавлено» — навсегда; «позже» — на неделю, после
// чего предлагаем снова (кто заходит регулярно — увидит ещё раз).

const KEY = 'home_screen_offer';
export const SNOOZE_DAYS = 7;
const DAY_MS = 86_400_000;

export type OfferMemory =
  | { kind: 'fresh' }
  | { kind: 'added' }
  | { kind: 'never' }
  | { kind: 'snoozed'; until: number };

/** Чистая логика: разбор сырого значения localStorage. */
export function parseOfferMemory(raw: string | null): OfferMemory {
  if (!raw) return { kind: 'fresh' };
  if (raw === 'added' || raw === 'never') return { kind: raw };
  const until = Number(raw);
  return Number.isFinite(until) && until > 0
    ? { kind: 'snoozed', until }
    : { kind: 'fresh' };
}

export function getOfferMemory(): OfferMemory {
  try {
    return parseOfferMemory(localStorage.getItem(KEY));
  } catch {
    return { kind: 'fresh' };
  }
}

function write(value: string): boolean {
  try {
    localStorage.setItem(KEY, value);
    return true;
  } catch {
    return false; // приватный режим — предложение просто вернётся в следующий раз
  }
}

export const markHomeScreenNever = (): void => void write('never');
export const snoozeHomeScreen = (now: number = Date.now()): void =>
  void write(String(now + SNOOZE_DAYS * DAY_MS));

/** Из настроек предложение можно вернуть, даже если отказался «навсегда». */
export function resetHomeScreenOffer(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    return; // приватный режим: нечего сбрасывать
  }
}

/**
 * Чистая логика: показывать ли повторное предложение. Отдельно от React, чтобы
 * вся матрица (отказ, снуз, чужая платформа) была под тестом — вживую её не
 * прощёлкать: часть веток наступает через неделю.
 */
export function shouldOfferHomeScreen(input: {
  hostId: string;
  platform: string | undefined;
  memory: OfferMemory;
  now: number;
}): boolean {
  if (!canOfferHomeScreen(input.hostId, input.platform)) return false;
  switch (input.memory.kind) {
    case 'added':
    case 'never':
      return false;
    case 'snoozed':
      return input.now >= input.memory.until;
    case 'fresh':
      return true;
  }
}

/**
 * Подводка под то, что человек реально увидит после нажатия. Один источник
 * текста на оба места (карточка-напоминание и настройки), иначе формулировки
 * разъедутся. Обращения в строках нет — `tr` не нужен.
 */
export function buildHomeScreenHint(platform: HomeScreenPlatform): string {
  if (platform === 'ios') {
    return 'Откроется сайт в Safari: «Поделиться» → «На экран „Домой“» — и значок встанет рядом с приложениями.';
  }
  return 'Откроется сайт в браузере — там кнопка «Установить приложение».';
}
