import { Markup } from 'telegraf';
import { CABINET_URL } from '../telegram/telegram.constants';
import { MODE_PHRASES } from './mode-phrases';
import { NEED_NAMES } from '../bot/need-names';
import { pluralDays } from './notification.templates.soft';
import type { NotificationTemplate } from './notification.templates';

// «Повторы недели». Payload — только {kind, key, count}: ключи, не текст.
// В Telegram названия режимов и потребностей не уходят (РКН, #1135) — только факт
// и кнопка; в приложении (push) текст с названием.
const selfMapButton = Markup.button.webApp(
  '🗺 Открыть «Карту себя»',
  `${CABINET_URL}?startapp=selfmap`,
);

const pluralTimes = (n: number) =>
  n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'раза' : 'раз';

/** Фразы режима бывают в кавычках-цитатах («…») — внешние снимаем, чтобы не вкладывать. */
const bare = (s: string) => s.replace(/^«(.*)»$/, '$1');

function pushText(p: Record<string, unknown>): string | null {
  const count = Number(p.count);
  if (!Number.isInteger(count) || count < 2) return null;
  if (p.kind === 'mode' && typeof p.key === 'string' && MODE_PHRASES[p.key]) {
    return `За неделю чаще всего возвращалось: «${bare(MODE_PHRASES[p.key])}» — ${count} ${pluralTimes(count)}. Подробнее в «Карте себя».`;
  }
  if (p.kind === 'need' && typeof p.key === 'string' && NEED_NAMES[p.key]) {
    return `Чаще всего проседала потребность «${NEED_NAMES[p.key]}» — ${count} ${pluralDays(count)}. Подробнее в «Карте себя».`;
  }
  return null;
}

export function renderWeeklyRepeat(
  payload: Record<string, unknown> | undefined,
  channel: 'push' | 'telegram',
): NotificationTemplate {
  const named = channel === 'push' && payload ? pushText(payload) : null;
  return {
    text:
      named ??
      'За неделю в записях что-то повторилось — это видно в «Карте себя».',
    keyboard: Markup.inlineKeyboard([[selfMapButton]]),
  };
}
