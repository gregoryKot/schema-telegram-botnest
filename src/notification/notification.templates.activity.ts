import { Markup } from 'telegraf';
import {
  CABINET_HELP_URL,
  CABINET_YSQ_URL,
  cabinetTasksUrl,
} from '../telegram/telegram.constants';
import type { NotificationTemplate } from './notification.templates';
import { NotificationType } from './notification.service';
import { AddressForm, t } from './address-form';
import { openDiaryButton, bookingButton } from './notification.buttons';

// Шаблоны про активность: практики, подсказка про Помощь, задания
// терапевта, активность пары, запрос теста на схемы. Вынесено из
// notification.templates.ts (правило №10) по образцу
// notification.templates.soft.ts — renderTemplate делегирует сюда.
const ON_WEEKDAY = [
  'на воскресенье',
  'на понедельник',
  'на вторник',
  'на среду',
  'на четверг',
  'на пятницу',
  'на субботу',
];

export function renderActivityTemplate(
  type: NotificationType,
  payload?: Record<string, unknown>,
  form: AddressForm = 'ty',
): NotificationTemplate | null {
  switch (type) {
    // Текст плана, текст задания и название потребности в Telegram не уходят
    // (РКН, #1135): payload не читается, кроме числовых taskId и weekday.
    case 'practice_reminder':
      return {
        text: '🎯 Время для плана практики. Он ждёт в приложении.',
        keyboard: Markup.inlineKeyboard([[openDiaryButton]]),
      };

    case 'practice_missed': {
      // День недели — индексом в таблице: строку из payload не берём.
      const wd = payload?.weekday;
      const day =
        typeof wd === 'number' && Number.isInteger(wd)
          ? ON_WEEKDAY[wd]
          : undefined;
      return {
        text: `🎯 ${day ? `План ${day}` : 'Вчера был план'}: как получилось? Отметить можно в приложении.`,
        keyboard: Markup.inlineKeyboard([[openDiaryButton]]),
      };
    }

    case 'low_streak_insight':
      return {
        text: t(
          form,
          '🌿 В приложении есть раздел Помощь: инструменты на разные случаи и запись на сессию. Загляни, когда будет минутка.',
          '🌿 В приложении есть раздел Помощь: инструменты на разные случаи и запись на сессию. Загляните, когда будет минутка.',
        ),
        keyboard: Markup.inlineKeyboard([
          [Markup.button.webApp('📱 Раздел Помощь', CABINET_HELP_URL)],
          [bookingButton],
        ]),
      };

    case 'task_assigned': {
      const taskId =
        typeof payload?.taskId === 'number' ? payload.taskId : undefined;
      // Кнопка ведёт к самому заданию (U2): «Сегодня» заданий не показывает.
      return {
        text: '📋 Новое задание от терапевта — оно в приложении.',
        keyboard: Markup.inlineKeyboard([
          [Markup.button.webApp('📋 Открыть задание', cabinetTasksUrl(taskId))],
        ]),
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
          [Markup.button.webApp('📋 Пройти тест', CABINET_YSQ_URL)],
        ]),
      };
    }

    default:
      return null;
  }
}
