import { Markup } from 'telegraf';
import { NotificationType } from './notification.service';
import { renderSoftTemplate, pluralDays } from './notification.templates.soft';
import { AddressForm, t } from './address-form';
import { renderActivityTemplate } from './notification.templates.activity';
import { renderSecurityNotice } from '../auth/security-notice.texts';
import {
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
      const variant = (payload?.variant as number | undefined) ?? 0;

      const onBreak = payload?.onBreak === true;
      const compactControls = payload?.compactControls === true;

      const intros = onBreak ? BREAK_INTROS : REMINDER_INTROS;
      const intro = intros[variant % intros.length];
      let text = t(form, intro[0], intro[1]);
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
        text: '🕐 Трекер на сегодня ещё не заполнен — займёт минуту.',
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

    // Оценки, средние и тренды в Telegram не уходят (РКН, #1135): только факт
    // и кнопка в приложение. Payload не читается — старые строки очереди
    // с прежним text рендерятся так же.
    case 'weekly':
      return {
        text: '📊 Итоги недели готовы — они ждут в приложении.',
        keyboard: Markup.inlineKeyboard([[openDiaryButton]]),
      };

    case 'summary':
      return {
        text: '📔 Оценки за сегодня сохранены. Итог дня — в приложении.',
        keyboard: Markup.inlineKeyboard([[openDiaryButton]]),
      };

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

    case 'security_notice':
      return renderSecurityNotice(payload, form);
    // comeback / welcome_back / lapsing_* / dormant_7 / reengagement_30 / nudge —
    // мягкие сообщения про перерывы живут в отдельном модуле
    default:
      return (
        renderActivityTemplate(type, payload, form) ??
        renderSoftTemplate(type, payload, form)
      );
  }
}
