import { Markup } from 'telegraf';
import { CABINET_URL } from '../telegram/telegram.constants';
import type { NotificationTemplate } from './notification.templates';
import { AddressForm, t } from './address-form';

const openDiaryButton = Markup.button.webApp(
  '📱 Открыть «Всё по схеме»',
  CABINET_URL,
);

/** N день / N дня / N дней */
export function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
  return 'дней';
}

const NUDGE_TEXTS: Array<[string, string]> = [
  [
    'Просто напоминаю, что я есть. Без ожиданий.',
    'Просто напоминаю, что я есть. Без ожиданий.',
  ],
  [
    'Если появится желание снова отслеживать состояние — хватит и одного дня, чтобы начать.',
    'Если появится желание снова отслеживать состояние — хватит и одного дня, чтобы начать.',
  ],
  [
    'Ничего не потерялось — вернуться можно в любой момент, с чистого листа или с того же места.',
    'Ничего не потерялось — вернуться можно в любой момент, с чистого листа или с того же места.',
  ],
];

/**
 * Мягкие сообщения про перерывы и возвращения. Правила тона:
 * без вины, без «ты пропустил», без сгоревших серий, без восклицательного чирлидинга.
 * Перерыв — часть процесса, а не сбой.
 */
export function renderSoftTemplate(
  type: string,
  payload?: Record<string, unknown>,
  form: AddressForm = 'ty',
): NotificationTemplate | null {
  switch (type) {
    case 'comeback': {
      const totalDays = payload?.totalDays as number | undefined;
      const daysLine =
        totalDays && totalDays > 1
          ? t(
              form,
              `\nВсего у тебя уже ${totalDays} ${pluralDays(totalDays)} наблюдений. Они никуда не делись.`,
              `\nВсего у вас уже ${totalDays} ${pluralDays(totalDays)} наблюдений. Они никуда не делись.`,
            )
          : '';
      return {
        text:
          t(
            form,
            'С возвращением. Ты снова здесь — это главное.',
            'С возвращением. Вы снова здесь — это главное.',
          ) + daysLine,
      };
    }

    // День 14 без записей: напоминание, что записи на месте. Оценок и средних
    // в Telegram нет (РКН, #1135) — только число дней наблюдений.
    case 'value_recap': {
      const totalDays = payload?.totalDays as number | undefined;
      const daysPart = totalDays
        ? `За ${totalDays} ${pluralDays(totalDays)} наблюдений`
        : 'За это время';
      return {
        text: t(
          form,
          `${daysPart} у тебя сложилась картина. Это твои данные, и они остаются твоими в любой день. Открыть её в приложении можно, когда появится интерес.`,
          `${daysPart} у вас сложилась картина. Это ваши данные, и они остаются вашими в любой день. Открыть её в приложении можно, когда появится интерес.`,
        ),
        keyboard: Markup.inlineKeyboard([[openDiaryButton]]),
      };
    }

    case 'welcome_back':
      return {
        text: t(
          form,
          'Привет. Пауза закончилась — я снова на связи.\n\nПродолжить наблюдения можно, когда появится желание. Нужно ещё времени — паузу легко продлить.',
          'Здравствуйте. Пауза закончилась — я снова на связи.\n\nПродолжить наблюдения можно, когда появится желание. Нужно ещё времени — паузу легко продлить.',
        ),
        keyboard: Markup.inlineKeyboard([
          [openDiaryButton],
          [Markup.button.callback('⏸ Ещё паузу', 'notify:pause')],
        ]),
      };

    // lapsing_2/lapsing_4 — legacy-строки в очереди на момент деплоя, рендерим мягким текстом
    case 'lapsing_2':
    case 'lapsing_4':
    case 'lapsing_3':
      return {
        text: 'Пара дней без трекера ничего не портит. Записи никуда не делись — продолжить можно с любого дня.',
        keyboard: Markup.inlineKeyboard([[openDiaryButton]]),
      };

    case 'dormant_7':
      return {
        text: t(
          form,
          'Неделя без трекера — ничего страшного. Наблюдать за собой — не обязанность.\n\nЕсли захочешь вернуться, всё сохранилось. А если сейчас не до этого — можно поставить паузу, и я не буду писать.',
          'Неделя без трекера — ничего страшного. Наблюдать за собой — не обязанность.\n\nЕсли захотите вернуться, всё сохранилось. А если сейчас не до этого — можно поставить паузу, и я не буду писать.',
        ),
        keyboard: Markup.inlineKeyboard([
          [openDiaryButton],
          [Markup.button.callback('⏸ Пауза', 'notify:pause')],
        ]),
      };

    case 'reengagement_30':
      return {
        text: t(
          form,
          'Прошёл месяц. Возможно, сейчас трекер не нужен — и это тоже нормально.\n\nЕсли когда-нибудь захочется снова понаблюдать за собой, все записи останутся в приложении. Начать можно с одного дня.',
          'Прошёл месяц. Возможно, сейчас трекер не нужен — и это тоже нормально.\n\nЕсли когда-нибудь захочется снова понаблюдать за собой, все записи останутся в приложении. Начать можно с одного дня.',
        ),
        keyboard: Markup.inlineKeyboard([[openDiaryButton]]),
      };

    case 'nudge': {
      const days = payload?.daysSince as number | undefined;
      const idx = days ? Math.floor(days / 45) % NUDGE_TEXTS.length : 0;
      return {
        text: t(form, NUDGE_TEXTS[idx][0], NUDGE_TEXTS[idx][1]),
        keyboard: Markup.inlineKeyboard([[openDiaryButton]]),
      };
    }

    default:
      return null;
  }
}
