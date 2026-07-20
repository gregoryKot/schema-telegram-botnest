// Предложение «добавить мини-апп на домашний экран».
//
// Картинку с инструкцией рисует САМ Telegram — мы только зовём
// WebApp.addToHomeScreen(). На iOS их нативный экран показывает
// Android-инструкцию («нажми три точки»), а открывает системный шит
// «Поделиться». Сам механизм при этом рабочий — врёт только картинка,
// поэтому на iOS пишем СВОЮ подводку под то, что человек реально увидит
// («Поделиться» → «На экран „Домой"»), а не прячем возможность целиком.

// Значения window.Telegram.WebApp.platform: 'android' | 'android_x' | 'ios' |
// 'macos' | 'tdesktop' | 'weba' | 'webk' | 'unknown'.
export type HomeScreenPlatform = 'android' | 'ios' | 'other';

// Статус значка Telegram отдаёт сам (Bot API 8.0) — не надо спрашивать
// человека «ты добавил?»: 'added' значит значок уже на экране.
export type TgHomeScreenStatus = 'unsupported' | 'unknown' | 'added' | 'missed';

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
  platform: string | undefined,
  hasApi: boolean,
): boolean {
  return hasApi && homeScreenPlatform(platform) !== 'other';
}

export function canOfferHomeScreenNow(): boolean {
  const tg = window.Telegram?.WebApp;
  return canOfferHomeScreen(tg?.platform, !!tg?.addToHomeScreen);
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

function write(value: string): void {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    // приватный режим — предложение просто вернётся в следующий раз
  }
}

export const markHomeScreenAdded = (): void => write('added');
export const markHomeScreenNever = (): void => write('never');
export const snoozeHomeScreen = (now: number = Date.now()): void =>
  write(String(now + SNOOZE_DAYS * DAY_MS));

/** Из настроек предложение можно вернуть, даже если отказался «навсегда». */
export function resetHomeScreenOffer(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/**
 * Чистая логика: показывать ли повторное предложение. Отдельно от React, чтобы
 * вся матрица (отказ, снуз, уже добавлено, чужая платформа) была под тестом —
 * вживую её не прощёлкать: часть веток наступает через неделю.
 */
export function shouldOfferHomeScreen(input: {
  platform: string | undefined;
  hasApi: boolean;
  tgStatus?: TgHomeScreenStatus;
  memory: OfferMemory;
  now: number;
}): boolean {
  if (!canOfferHomeScreen(input.platform, input.hasApi)) return false;
  // Слово Telegram важнее нашей памяти: значок мог появиться или пропасть мимо
  // нас (добавили с другого устройства, снесли с экрана).
  if (input.tgStatus === 'added') return false;
  switch (input.memory.kind) {
    case 'added':
      // Telegram говорит, что значка нет → наша отметка устарела, предлагаем.
      return input.tgStatus === 'missed';
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
 * текста на оба места (шаг онбординга и карточка-напоминание), иначе
 * формулировки разъедутся.
 */
export function buildHomeScreenHint(
  platform: HomeScreenPlatform,
  tr: (ty: string, vy: string) => string,
): string {
  if (platform === 'ios') {
    return tr(
      'Откроется меню «Поделиться» — выбери в нём «На экран „Домой“». Если мелькнёт картинка с тремя точками — не обращай внимания, Telegram показывает её всем одинаково.',
      'Откроется меню «Поделиться» — выберите в нём «На экран „Домой“». Если мелькнёт картинка с тремя точками — не обращайте внимания, Telegram показывает её всем одинаково.',
    );
  }
  return tr(
    'Telegram спросит подтверждение — согласись, и значок появится на экране.',
    'Telegram спросит подтверждение — согласитесь, и значок появится на экране.',
  );
}
