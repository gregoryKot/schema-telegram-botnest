import { uniqueViolationOn } from '../prisma/unique-violation';

/** Сколько раз пробуем вставить связь, пока случайный urlCode не окажется свободным. */
export const URL_CODE_ATTEMPTS = 3;

/**
 * Вставка TherapyRelation с повтором при коллизии `urlCode`. Через неё идут
 * все пути создания связи: приглашение (и из офлайн-карточки) и офлайн-клиент.
 *
 * Код адреса карточки ставит Postgres (`@default(dbgenerated(…))` в
 * schema.prisma): 8 знаков из 16, около 4·10⁹ значений. Совпадение с чужим
 * кодом роняло создание 23505, хотя следующий INSERT получит новый код сам
 * (на 10 000 строк perf-сида дубль ловился примерно в 1% прогонов, #1030).
 * Повторяется только конфликт по `urlCode`: дубль `code` или активной пары —
 * не случайность, повтор его не лечит.
 *
 * Не для вызова внутри `$transaction`: упавший INSERT обрывает транзакцию
 * Postgres, и повтор в ней не пройдёт.
 */
export async function insertRelation<T>(insert: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await insert();
    } catch (err) {
      if (attempt >= URL_CODE_ATTEMPTS || !uniqueViolationOn(err, 'urlCode'))
        throw err;
    }
  }
}
