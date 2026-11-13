// «X задан → Y тоже обязан быть задан» — общий кирпич кросс-проверок env
// (CROSS_CHECKS в env-check.ts и его файлы-спутники). Отдельный модуль:
// env-check.ts под храповиком размера (правило №10), а спутнику, импортирующему
// значение из env-check.ts, пришлось бы замыкать импорты в кольцо.
import type { CrossCheck } from './env-check';

type Env = Record<string, string | undefined>;

const isSet = (env: Env, key: string): boolean => Boolean(env[key]?.trim());

export function requiresToo(
  id: string,
  cause: string,
  ...deps: string[]
): CrossCheck {
  return {
    id,
    check: (env) => {
      if (!isSet(env, cause)) return null;
      const missing = deps.filter((d) => !isSet(env, d));
      if (missing.length === 0) return null;
      return `${cause} задан, но не задан(ы) ${missing.join(', ')}`;
    },
  };
}
