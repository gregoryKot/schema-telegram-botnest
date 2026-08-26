import { Markup } from 'telegraf';
import { NotificationType } from './notification.service';
import { BOOKING_URL, MINIAPP_URL } from '../telegram/telegram.constants';
import { Need, NeedId } from '../bot/bot.service';
import { renderSoftTemplate, pluralDays } from './notification.templates.soft';
import { AddressForm, t } from './address-form';
import { renderActivityTemplate } from './notification.templates.activity';
import {
  MONTHS,
  pickPractice,
  DONATE_MESSAGES,
  REMINDER_INTROS,
  BREAK_INTROS,
} from './notification.template-data';
import {
  openDiaryButton,
  donateButton,
  snoozeButton,
  skipTodayButton,
  pauseButton,
  slowerButton,
} from './notification.buttons';

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

      const onBreak = payload?.onBreak === true;
      const compactControls = payload?.compactControls === true;

      const intros = onBreak ? BREAK_INTROS : REMINDER_INTROS;
      const intro = intros[variant % intros.length];
      let text = t(form, intro[0], intro[1]);
      // Данные «за вчера» и практику показываем только активному юзеру: на перерыве
      // вчерашней записи нет, а лишняя нагрузка ломает мягкий тон возвращения.
      if (!onBreak) {
        if (yesterdayAvg !== undefined) {
          text += `\nВчера индекс был ${yesterdayAvg.toFixed(1)}.`;
        }
        if (lowestNeed && lowestNeedId) {
          const practice = pickPractice(lowestNeedId, seed);
          text += `\n\n${lowestNeed} просит внимания. ${t(form, 'Попробуй', 'Попробуйте')}: ${practice}`;
        } else if (lowestNeed) {
          text += ` ${t(form, 'Обрати', 'Обратите')} внимание на ${lowestNeed}.`;
        }
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
      // Вовлечённому юзеру — компактно (открыть + «реже»), чтобы напоминание не было
      // простынёй кнопок. При признаках усталости/перерыве — полный набор escape-hatch'ей
      // (через час / сегодня не могу / пауза / реже), чтобы сбросить частоту в один тап.
      return {
        text,
        keyboard: Markup.inlineKeyboard(
          compactControls
            ? [[openDiaryButton], [slowerButton]]
            : [
                [openDiaryButton],
                [snoozeButton, skipTodayButton],
                [pauseButton, slowerButton],
              ],
        ),
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
        text: '14 дней подряд. В истории уже виден график, а не отдельные дни.',
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
          '📅 Два месяца. Ты уже не гадаешь задним числом — открываешь историю и сверяешься с цифрами.',
          '📅 Два месяца. Вы уже не гадаете задним числом — открываете историю и сверяетесь с цифрами.',
        ),
      };

    case 'anniversary_90':
      return {
        text: '📅 Три месяца без перерыва — дольше, чем живёт большинство привычек вообще.',
      };

    // comeback / welcome_back / lapsing_* / dormant_7 / reengagement_30 / nudge —
    // мягкие сообщения про перерывы живут в отдельном модуле
    default:
      return (
        renderActivityTemplate(type, payload, form) ??
        renderSoftTemplate(type, payload, form)
      );
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
