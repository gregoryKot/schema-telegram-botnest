// Карточка сверки привязки аккаунтов в Telegram: текст и клавиатура. Чистые
// функции без Nest — вынесены из telegram.link.service.ts (правило №10).
import { Markup } from 'telegraf';
import { t, type AddressForm } from '../notification/address-form';
import { formatUserCode } from './ticket-code';

/** Сколько строк «что переедет» показываем, чтобы карточка осталась читаемой. */
const MAX_SUMMARY_ROWS = 4;

// Ключи — имена таблиц из USER_OWNED_TABLES, как их отдаёт merge.summarize.
// Показываем только то, что человек узнаёт: служебные строки (провайдеры
// входа, очередь уведомлений, события аналитики) ему ни о чём не говорят.
const SUMMARY_LABELS: Record<string, string> = {
  Rating: 'Оценки',
  Note: 'Заметки',
  SchemaDiaryEntry: 'Дневник схем',
  ModeDiaryEntry: 'Дневник режимов',
  GratitudeDiaryEntry: 'Дневник благодарности',
  UserSchemaNote: 'Карточки схем',
  UserModeNote: 'Карточки режимов',
  UserLetter: 'Письма',
  UserFlashcard: 'Карточки',
  PracticePlan: 'Планы практик',
  PracticeSession: 'Практики',
  YsqResult: 'Результаты теста',
  ChildhoodRating: 'Детские потребности',
};

/** «Оценки — 87, Дневник схем — 14» из сводки переноса. */
export function summaryLine(summary: Record<string, number>): string {
  const rows = Object.entries(summary)
    .filter(([key, n]) => n > 0 && SUMMARY_LABELS[key])
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SUMMARY_ROWS)
    .map(([key, n]) => `${SUMMARY_LABELS[key]} — ${n}`);
  return rows.join(', ');
}

export function linkConfirmText(
  form: AddressForm,
  code: string,
  deviceLabel: string,
  summary: Record<string, number>,
): string {
  const device = deviceLabel ? `\nОткуда: ${deviceLabel}` : '';
  const moving = summaryLine(summary);
  const movingLine = moving ? `\n\nЧто переедет: ${moving}` : '';
  return (
    `🔗 <b>Объединить аккаунты</b>\n\n` +
    `Код на экране: <b>${formatUserCode(code)}</b>${device}${movingLine}\n\n` +
    t(
      form,
      'Там открыто приложение под другим входом. Подтвердишь — записи оттуда ' +
        'переедут сюда, и дальше всё будет в одном месте.\n\n' +
        'Подтверждай, только если код виден у тебя на экране прямо сейчас. ' +
        'Код прислали со стороны — жми «Это не я».',
      'Там открыто приложение под другим входом. Подтвердите — записи оттуда ' +
        'переедут сюда, и дальше всё будет в одном месте.\n\n' +
        'Подтверждайте, только если код виден у вас на экране прямо сейчас. ' +
        'Код прислали со стороны — жмите «Это не я».',
    )
  );
}

export function linkKeyboard(code: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Это я, объединить', `tglink:yes:${code}`)],
    [Markup.button.callback('Это не я', `tglink:no:${code}`)],
  ]);
}
