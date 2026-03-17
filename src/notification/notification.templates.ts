import { Markup } from 'telegraf';
import { NotificationType } from './notification.service';
import { BOOKING_URL, MINIAPP_URL } from '../telegram/telegram.constants';
import { Need, NeedId } from '../bot/bot.service';

const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

function formatDate(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function buildSummaryText(needs: Need[], ratings: Partial<Record<NeedId, number>>, tzOffset = 0): string {
  const lines = needs.map((n) => {
    const v = ratings[n.id];
    if (v === undefined) return `${n.emoji} ${'⬜'.repeat(10)} –`;
    return `${n.emoji} ${'🟩'.repeat(v)}${'⬜'.repeat(10 - v)} ${v}/10`;
  });
  const legend = needs.map((n) => `${n.emoji} ${n.chartLabel}`).join('\n');
  const localDate = new Date(Date.now() + tzOffset * 3600_000);
  return `📔 Дневник потребностей · ${formatDate(localDate)}\nТвои оценки за сегодня 👇\n\n${lines.join('\n')}\n\n${legend}`;
}

const openDiaryButton = Markup.button.webApp('📱 Открыть дневник', MINIAPP_URL);
const bookingButton = Markup.button.url('📝 Записаться на сессию', BOOKING_URL);

export interface NotificationTemplate {
  text: string;
  keyboard?: ReturnType<typeof Markup.inlineKeyboard>;
}

export function renderTemplate(
  type: NotificationType,
  payload?: Record<string, unknown>,
): NotificationTemplate | null {
  switch (type) {
    case 'reminder': {
      const streak = payload?.streak as number | undefined;
      const lowestNeed = payload?.lowestNeed as string | undefined;
      const yesterdayAvg = payload?.yesterdayAvg as number | undefined;

      let text = '📔 Как ты сегодня?';
      if (yesterdayAvg !== undefined) {
        text += `\nВчера было ${yesterdayAvg.toFixed(1)}.`;
      }
      if (lowestNeed) {
        text += ` Как сегодня с ${lowestNeed}?`;
      } else {
        text += '\nЕщё не отметил потребности — займёт минуту.';
      }
      if (streak && streak >= 3) {
        text += `\n\n🔥 Серия: ${streak} ${streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'} подряд.`;
      }
      return { text, keyboard: Markup.inlineKeyboard([[openDiaryButton]]) };
    }

    case 'pre_reminder':
      return {
        text: '🕐 Ещё есть время заполнить дневник до конца дня.',
        keyboard: Markup.inlineKeyboard([[openDiaryButton]]),
      };

    case 'onboarding_1':
      return {
        text: 'Первая запись сделана.\n\nПаттерн начнёт проявляться через 3–5 дней — возвращайся завтра.',
        keyboard: Markup.inlineKeyboard([[openDiaryButton]]),
      };

    case 'onboarding_3':
      return {
        text: 'Три дня подряд — уже кое-что видно.\n\nЗайди в историю и посмотри как менялись потребности.',
        keyboard: Markup.inlineKeyboard([[openDiaryButton]]),
      };

    case 'onboarding_7':
      return {
        text: 'Неделя наблюдений — серьёзно.\n\nТы уже знаешь про себя больше, чем большинство людей.',
        keyboard: Markup.inlineKeyboard([[openDiaryButton]]),
      };

    case 'streak_7':
      return {
        text: '7 дней подряд. Паттерн уже читается.',
      };

    case 'streak_14':
      return {
        text: '14 дней. Ты видишь себя в динамике — это редкость.',
      };

    case 'streak_30':
      return {
        text: '30 дней наблюдений. Это серьёзная практика.',
      };

    case 'lapsing_2':
      return {
        text: 'Пара дней без записей — бывает. Как ты?',
        keyboard: Markup.inlineKeyboard([[openDiaryButton]]),
      };

    case 'lapsing_4':
      return {
        text: 'Дневник ждёт без давления.\nЕсли захочешь вернуться — всё на месте.',
        keyboard: Markup.inlineKeyboard([[openDiaryButton]]),
      };

    case 'dormant_7':
      return {
        text: 'Если захочешь снова начать отслеживать — я здесь.',
        keyboard: Markup.inlineKeyboard([[openDiaryButton]]),
      };

    case 'reengagement_30':
      return {
        text: 'Прошёл месяц. Если что-то изменилось и захочется разобраться — можно начать заново.',
        keyboard: Markup.inlineKeyboard([[openDiaryButton]]),
      };

    case 'weekly': {
      const text = payload?.text as string | undefined;
      if (!text) return null;
      return {
        text,
        keyboard: Markup.inlineKeyboard([[openDiaryButton]]),
      };
    }

    case 'summary': {
      const text = payload?.text as string | undefined;
      if (!text) return null;
      return {
        text,
        keyboard: Markup.inlineKeyboard([[openDiaryButton]]),
      };
    }

    default:
      return null;
  }
}

export function buildWeeklySummaryText(
  stats: Array<{ needId: NeedId; avg: number | null; trend: '↑' | '↓' | '→' }>,
  needs: Need[],
  bestDay: string | null,
): string {
  const lines = stats.map(({ needId, avg, trend }) => {
    const need = needs.find((n) => n.id === needId)!;
    if (avg === null) return `${need.emoji} ${need.chartLabel}  –`;
    return `${need.emoji} ${need.chartLabel}  ${avg.toFixed(1)} ${trend}`;
  });
  const bestLine = bestDay ? `\nЛучший день — ${bestDay} 🌟` : '';
  return `📊 Итоги недели\n\n${lines.join('\n')}${bestLine}`;
}

export function renderLowStreakInsight(
  emoji: string,
  needLabel: string,
  bookingUrl = BOOKING_URL,
): NotificationTemplate {
  return {
    text: `${emoji} ${needLabel} несколько дней невысокая.\n\nИногда за этим стоит что-то важное. Если хочется разобраться — я здесь.`,
    keyboard: Markup.inlineKeyboard([[Markup.button.url('📝 Записаться на сессию', bookingUrl)]]),
  };
}
