import { Markup } from 'telegraf';
import { MINIAPP_URL } from '../telegram/telegram.constants';
import type { NotificationTemplate } from './notification.templates';
import { NotificationType } from './notification.service';
import { AddressForm, t } from './address-form';
import { openDiaryButton, bookingButton } from './notification.buttons';
import { MONTHS } from './notification.template-data';

// Шаблоны про активность: практики, инсайт по низкой потребности, задания
// терапевта, активность пары, запрос теста на схемы. Вынесено из
// notification.templates.ts (правило №10) по образцу
// notification.templates.soft.ts — renderTemplate делегирует сюда.
export function renderActivityTemplate(
  type: NotificationType,
  payload?: Record<string, unknown>,
  form: AddressForm = 'ty',
): NotificationTemplate | null {
  switch (type) {
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
        // Формулировка намеренно безличная: она одинаково звучит
        // и в «ты», и в «вы», и не навязывает читателю мужской род.
        text: `🎯 План на сегодня:\n\n${text}`,
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
      const tn = payload?.therapistName as string | undefined;
      return {
        text: t(
          form,
          `📋 ${tn ? `Терапевт ${tn}` : 'Твой терапевт'} просит тебя пройти тест на схемы.\n\nЭто займёт 10–15 минут. Результаты помогут лучше понять твои схемы.`,
          `📋 ${tn ? `Терапевт ${tn}` : 'Ваш терапевт'} просит вас пройти тест на схемы.\n\nЭто займёт 10–15 минут. Результаты помогут лучше понять ваши схемы.`,
        ),
        keyboard: Markup.inlineKeyboard([
          [Markup.button.webApp('📋 Пройти тест', MINIAPP_URL)],
        ]),
      };
    }

    default:
      return null;
  }
}
