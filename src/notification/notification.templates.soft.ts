import { Markup } from 'telegraf';
import { MINIAPP_URL } from '../telegram/telegram.constants';
import type { NotificationTemplate } from './notification.templates';
import { AddressForm, t } from './address-form';

const openDiaryButton = Markup.button.webApp(
  '📱 Открыть «Всё по схеме»',
  MINIAPP_URL,
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
    'Если захочется снова отслеживать состояние — можно начать с одного дня, этого достаточно.',
    'Если захочется снова отслеживать состояние — можно начать с одного дня, этого достаточно.',
  ],
  [
    'Дневник на месте. Вернуться можно в любой момент — с чистого листа или с того же места.',
    'Дневник на месте. Вернуться можно в любой момент — с чистого листа или с того же места.',
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
      const strongest = payload?.strongestNeed as string | undefined;
      const strongestAvg = payload?.strongestAvg as number | undefined;
      const daysLine =
        totalDays && totalDays > 1
          ? t(
              form,
              `\nВсего у тебя уже ${totalDays} ${pluralDays(totalDays)} наблюдений. Они никуда не делись.`,
              `\nВсего у вас уже ${totalDays} ${pluralDays(totalDays)} наблюдений. Они никуда не делись.`,
            )
          : '';
      // Value-based штрих: зеркало собственных данных, а не просто «я есть».
      const valueLine =
        strongest && strongestAvg !== undefined
          ? t(
              form,
              `\nТвоя опора всё это время — ${strongest.toLowerCase()} (в среднем ${strongestAvg.toFixed(1)}).`,
              `\nВаша опора всё это время — ${strongest.toLowerCase()} (в среднем ${strongestAvg.toFixed(1)}).`,
            )
          : '';
      return {
        text:
          t(
            form,
            'С возвращением. Ты снова здесь — это главное.',
            'С возвращением. Вы снова здесь — это главное.',
          ) +
          daysLine +
          valueLine,
      };
    }

    // День 14 без записей: возврат через зеркало СОБСТВЕННЫХ данных, а не «я есть».
    // Заполняет окно между dormant_7 и reengagement_30.
    case 'value_recap': {
      const totalDays = payload?.totalDays as number | undefined;
      const strongest = payload?.strongest as string | undefined;
      const strongestAvg = payload?.strongestAvg as number | undefined;
      const weakest = payload?.weakest as string | undefined;
      const weakestAvg = payload?.weakestAvg as number | undefined;
      if (
        !strongest ||
        !weakest ||
        strongestAvg === undefined ||
        weakestAvg === undefined
      )
        return null;
      const daysPart = totalDays
        ? t(
            form,
            `За ${totalDays} ${pluralDays(totalDays)} наблюдений `,
            `За ${totalDays} ${pluralDays(totalDays)} наблюдений `,
          )
        : 'За это время ';
      return {
        text: t(
          form,
          `${daysPart}у тебя сложилась картина: ${strongest.toLowerCase()} — твоя опора (в среднем ${strongestAvg.toFixed(1)}), ${weakest.toLowerCase()} чаще проседала (${weakestAvg.toFixed(1)}).\n\nЭто твои данные — они никуда не делись. Захочешь глянуть, что изменилось, — дневник на месте.`,
          `${daysPart}у вас сложилась картина: ${strongest.toLowerCase()} — ваша опора (в среднем ${strongestAvg.toFixed(1)}), ${weakest.toLowerCase()} чаще проседала (${weakestAvg.toFixed(1)}).\n\nЭто ваши данные — они никуда не делись. Захотите глянуть, что изменилось, — дневник на месте.`,
        ),
        keyboard: Markup.inlineKeyboard([[openDiaryButton]]),
      };
    }

    case 'welcome_back':
      return {
        text: t(
          form,
          'Привет. Пауза закончилась — я снова на связи.\n\nЕсли захочешь продолжить наблюдения — дневник на месте. Если нужно ещё время, можно продлить паузу.',
          'Здравствуйте. Пауза закончилась — я снова на связи.\n\nЕсли захотите продолжить наблюдения — дневник на месте. Если нужно ещё время, можно продлить паузу.',
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
        text: 'Пара дней без записей — это нормально. Перерывы — часть процесса, а не сбой.\n\nВсе записи на месте, продолжить можно с любого дня.',
        keyboard: Markup.inlineKeyboard([[openDiaryButton]]),
      };

    case 'dormant_7':
      return {
        text: t(
          form,
          'Неделя без дневника — ничего страшного. Наблюдать за собой — не обязанность.\n\nЕсли захочешь вернуться, всё сохранилось. А если сейчас не до этого — можно поставить паузу, и я не буду писать.',
          'Неделя без дневника — ничего страшного. Наблюдать за собой — не обязанность.\n\nЕсли захотите вернуться, всё сохранилось. А если сейчас не до этого — можно поставить паузу, и я не буду писать.',
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
          'Прошёл месяц. Возможно, сейчас дневник не нужен — и это тоже нормально.\n\nЕсли когда-нибудь захочется снова понаблюдать за собой, всё твоё на месте. Начать можно с одного дня.',
          'Прошёл месяц. Возможно, сейчас дневник не нужен — и это тоже нормально.\n\nЕсли когда-нибудь захочется снова понаблюдать за собой, всё ваше на месте. Начать можно с одного дня.',
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
