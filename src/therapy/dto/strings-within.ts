import { ValidateBy, ValidationOptions, buildMessage } from 'class-validator';

// Граница длины строк внутри поля без схемы (`unknown[]`). Узлы и связи карты
// режимов приходят как есть — вложенный DTO с whitelist молча срезал бы
// поля, которых он не знает, а у узла их полтора десятка и они растут. Поэтому
// проверяется не форма, а то, что действительно раздувает тело: любая строка
// (и ключ объекта) на любой глубине. Обход — стеком, без рекурсии: глубина
// вложенности в теле на 256 КБ не ограничена ничем, кроме самого тела.

/** Все строки и ключи внутри значения не длиннее `max`. */
export function stringsWithin(value: unknown, max: number): boolean {
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const v = stack.pop();
    if (typeof v === 'string') {
      if (v.length > max) return false;
    } else if (v !== null && typeof v === 'object') {
      for (const [key, inner] of Object.entries(v)) {
        if (key.length > max) return false;
        stack.push(inner);
      }
    }
  }
  return true;
}

/** class-validator: ни одна строка внутри поля не длиннее `max` знаков. */
export function StringsWithin(
  max: number,
  options?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'stringsWithin',
      constraints: [max],
      validator: {
        validate: (value) => stringsWithin(value, max),
        defaultMessage: buildMessage(
          (each) =>
            `${each}$property: every string must be at most $constraint1 characters`,
          options,
        ),
      },
    },
    options,
  );
}
