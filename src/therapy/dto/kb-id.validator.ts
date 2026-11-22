import { ValidateBy, ValidationOptions, buildMessage } from 'class-validator';
import { isKbId, type KbIdKind } from '../kb-ids';

// Запись id режима, схемы или потребности в данные клиента — только существующий id
// справочника: опечатка или переименование иначе ложится в БД молча. Чтение не проверяется.

/** class-validator: значение (или каждый элемент при `each`) — id справочника вида `kind`. */
export function IsKbId(
  kind: KbIdKind,
  options?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isKbId',
      constraints: [kind],
      validator: {
        validate: (value) => isKbId(kind, value),
        defaultMessage: buildMessage(
          (each) => `${each}$property: unknown $constraint1 id`,
          options,
        ),
      },
    },
    options,
  );
}
