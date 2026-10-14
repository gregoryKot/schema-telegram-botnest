// Загрузка модулей, читающих ENCRYPTION_KEY(_OLD) при импорте (src/utils/crypto.ts
// разбирает ключи один раз на уровне модуля), под заданной парой ключей.
// Каждый вызов даёт СВЕЖИЕ экземпляры модулей (jest.isolateModules): так один
// тест держит рядом «приложение со старым ключом» и «ротацию с новым».
//
// Использование: loadWithKeys({ key }, () => require('./crypto') as typeof import('./crypto'))
export function loadWithKeys<T>(
  keys: { key: string; old?: string },
  loader: () => T,
): T {
  process.env.ENCRYPTION_KEY = keys.key;
  process.env.ENCRYPTION_KEY_OLD = keys.old ?? '';
  process.env.NODE_ENV = 'test';
  let out!: T;
  jest.isolateModules(() => {
    // decrypt() по чужому шифротексту пишет error-лог — для этих тестов это
    // ожидаемый исход, а не шум.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nest = require('@nestjs/common') as typeof import('@nestjs/common');
    nest.Logger.overrideLogger(false);
    out = loader();
  });
  return out;
}
