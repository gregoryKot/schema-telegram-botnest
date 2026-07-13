import { Markup } from 'telegraf';
import { NotificationType } from './notification.service';
import {
  BOOKING_URL,
  MINIAPP_URL,
  DONATE_URL,
} from '../telegram/telegram.constants';
import { Need, NeedId } from '../bot/bot.service';
import { renderSoftTemplate, pluralDays } from './notification.templates.soft';
import { AddressForm, t } from './address-form';

const MONTHS = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

function formatDate(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

// One curated practice suggestion per need — short, concrete, fits in a notification.
// Формулировки нейтральные — работают и при «ты», и при «вы».
const CURATED_PRACTICE: Record<NeedId, string[]> = {
  attachment: [
    'Написать кому-то близкому без повода',
    'Спросить кого-то «Как ты на самом деле?»',
    'Поделиться чем-то личным в разговоре',
  ],
  autonomy: [
    'Принять одно решение самостоятельно, без совета',
    'Сделать что-то просто потому, что хочется',
    'Сказать «нет» одной просьбе, если не хочется',
  ],
  expression: [
    'Назвать вслух одну свою эмоцию',
    'Рассказать кому-то о том, что трогает',
    'Выразить несогласие мягко, но честно',
  ],
  play: [
    'Сделать что-то без цели — просто потому что весело',
    'Попробовать новое место или маршрут',
    'Поиграть во что-нибудь — хоть в игру на телефоне',
  ],
  limits: [
    'Закончить работу вовремя, не задерживаться',
    'Выполнить одно отложенное дело',
    'Соблюдать одно правило для себя весь день',
  ],
};

function pickPractice(needId: NeedId, seed: number): string {
  const list = CURATED_PRACTICE[needId];
  if (!list?.length) return '';
  return list[seed % list.length];
}

export function buildSummaryText(
  needs: Need[],
  ratings: Partial<Record<NeedId, number>>,
  tz = 'Europe/Moscow',
  form: AddressForm = 'ty',
): string {
  const lines = needs.map((n) => {
    const v = ratings[n.id];
    if (v === undefined) return `${n.emoji} ${'⬜'.repeat(10)} –`;
    return `${n.emoji} ${'🟩'.repeat(v)}${'⬜'.repeat(10 - v)} ${v}/10`;
  });
  const legend = needs.map((n) => `${n.emoji} ${n.chartLabel}`).join('\n');
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    day: 'numeric',
    month: 'numeric',
  }).formatToParts(now);
  const day = Number(
    parts.find((p) => p.type === 'day')?.value ?? now.getDate(),
  );
  const month =
    Number(parts.find((p) => p.type === 'month')?.value ?? now.getMonth() + 1) -
    1;
  const dateStr = `${day} ${MONTHS[month]}`;
  return `📔 Трекер потребностей · ${dateStr}\n${t(form, 'Твои', 'Ваши')} оценки за сегодня 👇\n\n${lines.join('\n')}\n\n${legend}`;
}

const openDiaryButton = Markup.button.webApp(
  '📱 Открыть «Всё по схеме»',
  MINIAPP_URL,
);
const bookingButton = Markup.button.url('📝 Записаться на сессию', BOOKING_URL);
const donateButton = Markup.button.url('💛 Поддержать проект', DONATE_URL);

// Rotated so the monthly nudge doesn't feel like the same canned message.
const DONATE_MESSAGES: Array<[string, string]> = [
  [
    '💛 «Всё по схеме» бесплатное и без рекламы. Если оно тебе помогает — поддержи проект, это помогает его развивать.',
    '💛 «Всё по схеме» бесплатное и без рекламы. Если оно вам помогает — поддержите проект, это помогает его развивать.',
  ],
  [
    '💛 Раз в месяц напоминаю: приложение живёт на поддержке пользователей. Любая сумма помогает.',
    '💛 Раз в месяц напоминаю: приложение живёт на поддержке пользователей. Любая сумма помогает.',
  ],
  [
    '💛 Если приложение приносит пользу — можно поддержать его разовым донатом. Спасибо, что ты здесь.',
    '💛 Если приложение приносит пользу — можно поддержать его разовым донатом. Спасибо, что вы здесь.',
  ],
];
const snoozeButton = Markup.button.callback('⏰ Через час', 'snooze_reminder');
const skipTodayButton = Markup.button.callback(
  'Сегодня не могу',
  'notify:skip',
);
const pauseButton = Markup.button.callback('⏸ Пауза', 'notify:pause');
const slowerButton = Markup.button.callback('🔕 Реже', 'notify:slower');

const REMINDER_INTROS: Array<[string, string]> = [
  [
    '📔 Трекер потребностей — отметь оценки за сегодня.',
    '📔 Трекер потребностей — отметьте оценки за сегодня.',
  ],
  [
    '📔 Пять оценок — и картина дня готова.',
    '📔 Пять оценок — и картина дня готова.',
  ],
  [
    '📔 Отметь потребности за сегодня — займёт меньше минуты.',
    '📔 Отметьте потребности за сегодня — займёт меньше минуты.',
  ],
  [
    '📔 Как ты сегодня? Минутка на пять оценок.',
    '📔 Как вы сегодня? Минутка на пять оценок.',
  ],
  [
    '📔 Момент для себя: как прошёл день?',
    '📔 Момент для себя: как прошёл день?',
  ],
];

export interface NotificationTemplate {
  text: string;
  keyboard?: ReturnType<typeof Markup.inlineKeyboard>;
}

export function renderTemplate(
  type: NotificationType,
  payload?: Record<string, unknown>,
  form: AddressForm = 'ty',
): NotificationTemplate | null {
  switch (type) {
    case 'reminder': {
      const streak = payload?.streak as number | undefined;
      const lowestNeedId = payload?.lowestNeedId as NeedId | undefined;
      const lowestNeed = payload?.lowestNeed as string | undefined;
      const yesterdayAvg = payload?.yesterdayAvg as number | undefined;
      const variant = (payload?.variant as number | undefined) ?? 0;
      const seed = (payload?.seed as number | undefined) ?? 0;

      const intro = REMINDER_INTROS[variant % REMINDER_INTROS.length];
      let text = t(form, intro[0], intro[1]);
      if (yesterdayAvg !== undefined) {
        text += `\nВчера индекс был ${yesterdayAvg.toFixed(1)}.`;
      }
      if (lowestNeed && lowestNeedId) {
        const practice = pickPractice(lowestNeedId, seed);
        text += `\n\n${lowestNeed} просит внимания. ${t(form, 'Попробуй', 'Попробуйте')}: ${practice}`;
      } else if (lowestNeed) {
        text += ` ${t(form, 'Обрати', 'Обратите')} внимание на ${lowestNeed}.`;
      }
      // Игровой режим (opt-in): позитивная срочность — показываем серию с 1 дня
      // и подсвечиваем «ещё день до вехи». Для остальных — серия только с 3 дней,
      // без давления. gamified/approachingStreak кладёт planner.
      const gamified = payload?.gamified as boolean | undefined;
      const approaching = payload?.approachingStreak as number | undefined;
      if (streak && (streak >= 3 || (gamified && streak >= 1))) {
        text += `\n\n🔥 Серия: ${streak} ${pluralDays(streak)} подряд.`;
      }
      if (gamified && approaching) {
        text += `\n🎯 Ещё один день — и будет ${approaching} ${pluralDays(approaching)} подряд.`;
      }
      return {
        text,
        keyboard: Markup.inlineKeyboard([
          [openDiaryButton],
          [snoozeButton, skipTodayButton],
          [pauseButton, slowerButton],
        ]),
      };
    }

    case 'pre_reminder':
      return {
        text: '🕐 Дневник ещё не заполнен — займёт минуту.',
        keyboard: Markup.inlineKeyboard([[openDiaryButton]]),
      };

    case 'onboarding_1':
      return {
        text: t(
          form,
          'Первая запись сделана.\n\nПаттерн начнёт проявляться через 3–5 дней — возвращайся завтра.',
          'Первая запись сделана.\n\nПаттерн начнёт проявляться через 3–5 дней — возвращайтесь завтра.',
        ),
        keyboard: Markup.inlineKeyboard([[openDiaryButton]]),
      };

    case 'onboarding_3':
      return {
        text: t(
          form,
          'Три дня подряд — уже кое-что видно.\n\nЗайди в историю и посмотри как менялись потребности.',
          'Три дня подряд — уже кое-что видно.\n\nЗайдите в историю и посмотрите, как менялись потребности.',
        ),
        keyboard: Markup.inlineKeyboard([[openDiaryButton]]),
      };

    case 'onboarding_7':
      return {
        text: t(
          form,
          'Неделя наблюдений — серьёзно.\n\nТы уже знаешь про себя больше, чем большинство людей.',
          'Неделя наблюдений — серьёзно.\n\nВы уже знаете про себя больше, чем большинство людей.',
        ),
        keyboard: Markup.inlineKeyboard([[openDiaryButton]]),
      };

    case 'streak_7':
      return {
        text: '7 дней подряд. Паттерн уже читается.',
      };

    case 'streak_14':
      return {
        text: t(
          form,
          '14 дней. Ты видишь себя в динамике — это редкость.',
          '14 дней. Вы видите себя в динамике — это редкость.',
        ),
      };

    case 'streak_30':
      return {
        text: '30 дней наблюдений. Это серьёзная практика.',
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

    case 'donate_reminder': {
      const seed = (payload?.seed as number | undefined) ?? 0;
      const totalDays = payload?.totalDays as number | undefined;
      // Value-anchored ask: у давних юзеров привязываем просьбу к их собственному
      // вкладу («ты уже N дней…») — реципрокность + якорь ценности сильнее общего текста.
      if (totalDays && totalDays >= 30) {
        return {
          text: t(
            form,
            `💛 Ты уже ${totalDays} ${pluralDays(totalDays)} наблюдаешь за собой во «Всё по схеме» — и всё это время оно бесплатное и без рекламы. Если приложение приносит пользу, разовый донат помогает его развивать.`,
            `💛 Вы уже ${totalDays} ${pluralDays(totalDays)} наблюдаете за собой во «Всё по схеме» — и всё это время оно бесплатное и без рекламы. Если приложение приносит пользу, разовый донат помогает его развивать.`,
          ),
          keyboard: Markup.inlineKeyboard([[donateButton]]),
        };
      }
      const msg = DONATE_MESSAGES[seed % DONATE_MESSAGES.length];
      return {
        text: t(form, msg[0], msg[1]),
        keyboard: Markup.inlineKeyboard([[donateButton]]),
      };
    }

    case 'anniversary_30':
      return {
        text: t(
          form,
          '📅 Месяц наблюдений. Ты уже знаешь о себе больше, чем большинство людей знают за годы.',
          '📅 Месяц наблюдений. Вы уже знаете о себе больше, чем большинство людей знают за годы.',
        ),
      };

    case 'anniversary_60':
      return {
        text: t(
          form,
          '📅 Два месяца. Паттерн теперь устойчивый — ты видишь себя в динамике.',
          '📅 Два месяца. Паттерн теперь устойчивый — вы видите себя в динамике.',
        ),
      };

    case 'anniversary_90':
      return {
        text: '📅 Три месяца. Это серьёзная практика самопознания. Редкость.',
      };

    case 'practice_reminder': {
      const text = payload?.practiceText as string | undefined;
      const planId = payload?.planId as number | undefined;
      if (!text) return null;
      const buttons =
        planId !== undefined
          ? [
              [
                Markup.button.callback('✅ Сделано', `plan_done:${planId}`),
                Markup.button.callback(
                  '❌ Не получилось',
                  `plan_skip:${planId}`,
                ),
              ],
              [openDiaryButton],
            ]
          : [[openDiaryButton]];
      return {
        text: t(
          form,
          `🎯 Сегодня ты планировал:\n\n${text}`,
          `🎯 Сегодня вы планировали:\n\n${text}`,
        ),
        keyboard: Markup.inlineKeyboard(buttons),
      };
    }

    case 'practice_missed': {
      const text = payload?.practiceText as string | undefined;
      const planId = payload?.planId as number | undefined;
      if (!text) return null;
      const buttons =
        planId !== undefined
          ? [
              [
                Markup.button.callback(
                  '✅ Всё-таки сделано',
                  `plan_done:${planId}`,
                ),
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
        ? [
            [Markup.button.webApp('📱 Раздел Помощь', MINIAPP_URL)],
            [bookingButton],
          ]
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
        attachment: 'Привязанность',
        autonomy: 'Автономия',
        expression: 'Выражение чувств',
        play: 'Спонтанность',
        limits: 'Границы',
      };
      let msg = `👨‍⚕️ Терапевт назначил задание:\n\n${text}`;
      if (needId && NEED_LABELS[needId])
        msg += `\n\nПотребность: ${NEED_LABELS[needId]}`;
      if (dueDate) {
        const d = new Date(dueDate + 'T12:00:00Z'); // noon UTC — timezone-safe date parsing
        msg += `\nСрок: ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
      }
      return {
        text: msg,
        keyboard: Markup.inlineKeyboard([[openDiaryButton]]),
      };
    }

    // Парный триггер (аудит 2026-07, 4.5): напарник заполнил трекер.
    // Формулировка нейтральная по обращению, без сравнения и соревнования.
    case 'pair_activity': {
      return {
        text: '🤝 Напарник сегодня уже отметил свои потребности.\n\nХороший момент свериться с собой — минутка на пять оценок.',
        keyboard: Markup.inlineKeyboard([[openDiaryButton]]),
      };
    }

    case 'ysq_requested': {
      const therapistName = payload?.therapistName as string | undefined;
      const name = therapistName ? `Терапевт ${therapistName}` : 'Ваш терапевт';
      return {
        text: `📋 ${name} просит вас пройти Опросник схем Янга (YSQ).\n\nЭто займёт 10–15 минут. Результаты помогут лучше понять ваши схемы.`,
        keyboard: Markup.inlineKeyboard([
          [Markup.button.webApp('📋 Пройти тест YSQ', MINIAPP_URL)],
        ]),
      };
    }

    // comeback / welcome_back / lapsing_* / dormant_7 / reengagement_30 / nudge —
    // мягкие сообщения про перерывы живут в отдельном модуле
    default:
      return renderSoftTemplate(type, payload, form);
  }
}

export function buildWeeklySummaryText(
  stats: Array<{ needId: NeedId; avg: number | null; trend: '↑' | '↓' | '→' }>,
  needs: Need[],
  bestDay: string | null,
  seed = 0,
  form: AddressForm = 'ty',
): string {
  const lines = stats
    .map(({ needId, avg, trend }) => {
      const need = needs.find((n) => n.id === needId);
      if (!need) return null;
      if (avg === null) return `${need.emoji} ${need.chartLabel}  –`;
      return `${need.emoji} ${need.chartLabel}  ${avg.toFixed(1)} ${trend}`;
    })
    .filter(Boolean);
  const bestLine = bestDay ? `\nЛучший день — ${bestDay} 🌟` : '';

  // Find lowest need with data and suggest a practice
  const ratedStats = stats.filter((s) => s.avg !== null);
  const lowest = ratedStats.sort((a, b) => (a.avg ?? 10) - (b.avg ?? 10))[0];
  let actionLine = '';
  if (lowest && (lowest.avg ?? 10) < 6) {
    const need = needs.find((n) => n.id === lowest.needId);
    if (need) {
      const practice = pickPractice(lowest.needId, seed);
      actionLine = `\n\n💡 На этой неделе ${t(form, 'уделяй', 'уделяйте')} внимание ${need.chartLabel.toLowerCase()}.\n${t(form, 'Попробуй', 'Попробуйте')}: ${practice}`;
    }
  }

  return `📊 Итоги недели\n\n${lines.join('\n')}${bestLine}${actionLine}`;
}

export function renderLowStreakInsight(
  emoji: string,
  needLabel: string,
  daysBelowThreshold: number,
  form: AddressForm = 'ty',
  bookingUrl = BOOKING_URL,
): NotificationTemplate {
  const showBooking = daysBelowThreshold >= 10;
  const text = showBooking
    ? `${emoji} ${needLabel} уже ${daysBelowThreshold} дней невысокая.\n\nЭто может быть паттерн — стоит разобраться. Раздел Помощь в приложении или сессия с терапевтом помогут.`
    : `${emoji} ${needLabel} несколько дней невысокая.\n\nВ разделе Помощь есть инструменты для этого — ${t(form, 'попробуй', 'попробуйте')} что-нибудь прямо сегодня.`;
  return {
    text,
    keyboard: Markup.inlineKeyboard(
      showBooking
        ? [
            [Markup.button.webApp('📱 Раздел Помощь', MINIAPP_URL)],
            [Markup.button.url('📝 Записаться на сессию', bookingUrl)],
          ]
        : [[Markup.button.webApp('📱 Раздел Помощь', MINIAPP_URL)]],
    ),
  };
}
