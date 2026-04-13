import { Markup } from 'telegraf';
import { NotificationType } from './notification.service';
import { BOOKING_URL, MINIAPP_URL } from '../telegram/telegram.constants';
import { Need, NeedId } from '../bot/bot.service';

const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

function formatDate(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

// One curated practice suggestion per need — short, concrete, fits in a notification
const CURATED_PRACTICE: Record<NeedId, string[]> = {
  attachment: [
    'Написать кому-то близкому без повода',
    'Спросить кого-то «Как ты на самом деле?»',
    'Поделиться чем-то личным в разговоре',
  ],
  autonomy: [
    'Принять одно решение самостоятельно, без совета',
    'Сделать что-то только потому что хочешь',
    'Сказать «нет» одной просьбе, если не хочешь',
  ],
  expression: [
    'Назвать вслух одну свою эмоцию',
    'Рассказать кому-то о чём-то, что тебя трогает',
    'Выразить несогласие мягко, но честно',
  ],
  play: [
    'Сделать что-то без цели — просто потому что весело',
    'Попробовать новое место или маршрут',
    'Поиграть во что-нибудь — хоть в игру на телефоне',
  ],
  limits: [
    'Закончить работу вовремя, не задерживаться',
    'Выполнить одно дело, которое откладывал',
    'Соблюдать одно правило для себя весь день',
  ],
};

function pickPractice(needId: NeedId, seed: number): string {
  const list = CURATED_PRACTICE[needId];
  return list[seed % list.length];
}

export function buildSummaryText(needs: Need[], ratings: Partial<Record<NeedId, number>>, tz = 'Europe/Moscow'): string {
  const lines = needs.map((n) => {
    const v = ratings[n.id];
    if (v === undefined) return `${n.emoji} ${'⬜'.repeat(10)} –`;
    return `${n.emoji} ${'🟩'.repeat(v)}${'⬜'.repeat(10 - v)} ${v}/10`;
  });
  const legend = needs.map((n) => `${n.emoji} ${n.chartLabel}`).join('\n');
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, day: 'numeric', month: 'numeric' }).formatToParts(now);
  const day = Number(parts.find(p => p.type === 'day')?.value ?? now.getDate());
  const month = Number(parts.find(p => p.type === 'month')?.value ?? now.getMonth() + 1) - 1;
  const dateStr = `${day} ${MONTHS[month]}`;
  return `📔 Трекер потребностей · ${dateStr}\nТвои оценки за сегодня 👇\n\n${lines.join('\n')}\n\n${legend}`;
}

const openDiaryButton = Markup.button.webApp('📱 Открыть дневник', MINIAPP_URL);
const bookingButton = Markup.button.url('📝 Записаться на сессию', BOOKING_URL);
const snoozeButton = Markup.button.callback('⏰ Через час', 'snooze_reminder');

const REMINDER_INTROS = [
  '📔 Трекер потребностей — отметь оценки за сегодня.',
  '📔 Пять оценок — и картина дня готова.',
  '📔 Отметь потребности за сегодня — займёт меньше минуты.',
  '📔 Данные о себе копятся только если ты их вносишь.',
  '📔 Дневник ждёт сегодняшних оценок.',
];

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
      const lowestNeedId = payload?.lowestNeedId as NeedId | undefined;
      const lowestNeed = payload?.lowestNeed as string | undefined;
      const yesterdayAvg = payload?.yesterdayAvg as number | undefined;
      const variant = (payload?.variant as number | undefined) ?? 0;
      const seed = (payload?.seed as number | undefined) ?? 0;

      let text = REMINDER_INTROS[variant % REMINDER_INTROS.length];
      if (yesterdayAvg !== undefined) {
        text += `\nВчера индекс был ${yesterdayAvg.toFixed(1)}.`;
      }
      if (lowestNeed && lowestNeedId) {
        const practice = pickPractice(lowestNeedId, seed);
        text += `\n\n${lowestNeed} просит внимания. Попробуй: ${practice}`;
      } else if (lowestNeed) {
        text += ` Обрати внимание на ${lowestNeed}.`;
      }
      if (streak && streak >= 3) {
        text += `\n\n🔥 Серия: ${streak} ${streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'} подряд.`;
      }
      return { text, keyboard: Markup.inlineKeyboard([[openDiaryButton], [snoozeButton]]) };
    }

    case 'pre_reminder':
      return {
        text: '🕐 Дневник ещё не заполнен — займёт минуту.',
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
        text: 'Пара дней без записей — бывает. Вернёшься — всё сохранилось.',
        keyboard: Markup.inlineKeyboard([[openDiaryButton]]),
      };

    case 'lapsing_4':
      return {
        text: 'Без срочности. Когда вернёшься — всё на месте.',
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

    case 'nudge': {
      const days = payload?.daysSince as number | undefined;
      const texts = [
        'Иногда возвращаться полезнее, чем казалось.',
        'Когда всё стабилизируется — дневник снова покажет, что происходит.',
        'Без давления. Если захочешь — я здесь.',
        'Короткий период наблюдений лучше, чем долгое намерение начать.',
      ];
      const idx = days ? Math.floor(days / 30) % texts.length : 0;
      return {
        text: texts[idx],
        keyboard: Markup.inlineKeyboard([[openDiaryButton]]),
      };
    }

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

    case 'anniversary_30':
      return { text: '📅 Месяц наблюдений. Ты уже знаешь о себе больше, чем большинство людей знают за годы.' };

    case 'anniversary_60':
      return { text: '📅 Два месяца. Паттерн теперь устойчивый — ты видишь себя в динамике.' };

    case 'anniversary_90':
      return { text: '📅 Три месяца. Это серьёзная практика самопознания. Редкость.' };

    case 'practice_reminder': {
      const text = payload?.practiceText as string | undefined;
      const planId = payload?.planId as number | undefined;
      if (!text) return null;
      const buttons = planId !== undefined
        ? [
            [
              Markup.button.callback('✅ Сделал', `plan_done:${planId}`),
              Markup.button.callback('❌ Не получилось', `plan_skip:${planId}`),
            ],
            [openDiaryButton],
          ]
        : [[openDiaryButton]];
      return {
        text: `🎯 Сегодня ты планировал:\n\n${text}`,
        keyboard: Markup.inlineKeyboard(buttons),
      };
    }

    case 'practice_missed': {
      const text = payload?.practiceText as string | undefined;
      const planId = payload?.planId as number | undefined;
      if (!text) return null;
      const buttons = planId !== undefined
        ? [
            [
              Markup.button.callback('✅ Всё-таки сделал', `plan_done:${planId}`),
              Markup.button.callback('❌ Не вышло', `plan_skip:${planId}`),
            ],
            [openDiaryButton],
          ]
        : [[openDiaryButton]];
      return {
        text: `🎯 Вчера был план:\n\n${text}\n\nКак получилось?`,
        keyboard: Markup.inlineKeyboard(buttons),
      };
    }

    case 'low_streak_insight': {
      const text = payload?.text as string | undefined;
      const showBooking = payload?.showBooking as boolean | undefined;
      if (!text) return null;
      const buttons = showBooking
        ? [[Markup.button.webApp('📱 Раздел Помощь', MINIAPP_URL)], [bookingButton]]
        : [[Markup.button.webApp('📱 Раздел Помощь', MINIAPP_URL)]];
      return {
        text,
        keyboard: Markup.inlineKeyboard(buttons),
      };
    }

    case 'task_assigned': {
      const text = payload?.text as string | undefined;
      const needId = payload?.needId as string | undefined;
      const dueDate = payload?.dueDate as string | undefined;
      if (!text) return null;
      const NEED_LABELS: Record<string, string> = {
        attachment: 'Привязанность', autonomy: 'Автономия',
        expression: 'Выражение чувств', play: 'Спонтанность', limits: 'Границы',
      };
      let msg = `👨‍⚕️ Терапевт назначил задание:\n\n${text}`;
      if (needId && NEED_LABELS[needId]) msg += `\n\nПотребность: ${NEED_LABELS[needId]}`;
      if (dueDate) {
        const d = new Date(dueDate + 'T12:00:00Z'); // noon UTC — timezone-safe date parsing
        msg += `\nСрок: ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
      }
      return { text: msg, keyboard: Markup.inlineKeyboard([[openDiaryButton]]) };
    }

    case 'ysq_requested': {
      const therapistName = payload?.therapistName as string | undefined;
      const name = therapistName ? `Терапевт ${therapistName}` : 'Ваш терапевт';
      return {
        text: `📋 ${name} просит вас пройти Опросник схем Янга (YSQ).\n\nЭто займёт 10–15 минут. Результаты помогут лучше понять ваши схемы.`,
        keyboard: Markup.inlineKeyboard([[Markup.button.webApp('📋 Пройти тест YSQ', MINIAPP_URL)]]),
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
  seed = 0,
): string {
  const lines = stats.map(({ needId, avg, trend }) => {
    const need = needs.find((n) => n.id === needId)!;
    if (avg === null) return `${need.emoji} ${need.chartLabel}  –`;
    return `${need.emoji} ${need.chartLabel}  ${avg.toFixed(1)} ${trend}`;
  });
  const bestLine = bestDay ? `\nЛучший день — ${bestDay} 🌟` : '';

  // Find lowest need with data and suggest a practice
  const ratedStats = stats.filter(s => s.avg !== null);
  const lowest = ratedStats.sort((a, b) => (a.avg ?? 10) - (b.avg ?? 10))[0];
  let actionLine = '';
  if (lowest && (lowest.avg ?? 10) < 6) {
    const need = needs.find(n => n.id === lowest.needId);
    if (need) {
      const practice = pickPractice(lowest.needId as NeedId, seed);
      actionLine = `\n\n💡 На этой неделе уделяй внимание ${need.chartLabel.toLowerCase()}.\nПопробуй: ${practice}`;
    }
  }

  return `📊 Итоги недели\n\n${lines.join('\n')}${bestLine}${actionLine}`;
}

export function renderLowStreakInsight(
  emoji: string,
  needLabel: string,
  daysBelowThreshold: number,
  bookingUrl = BOOKING_URL,
): NotificationTemplate {
  const showBooking = daysBelowThreshold >= 10;
  const text = showBooking
    ? `${emoji} ${needLabel} уже ${daysBelowThreshold} дней невысокая.\n\nЭто может быть паттерн — стоит разобраться. Раздел Помощь в приложении или сессия с терапевтом помогут.`
    : `${emoji} ${needLabel} несколько дней невысокая.\n\nВ разделе Помощь есть инструменты для этого — попробуй что-нибудь прямо сегодня.`;
  return {
    text,
    keyboard: Markup.inlineKeyboard(
      showBooking
        ? [[Markup.button.webApp('📱 Раздел Помощь', MINIAPP_URL)], [Markup.button.url('📝 Записаться на сессию', bookingUrl)]]
        : [[Markup.button.webApp('📱 Раздел Помощь', MINIAPP_URL)]],
    ),
  };
}
