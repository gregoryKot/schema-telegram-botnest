// Кросс-проверки env почты (Yandex Cloud Postbox): подключаются в
// CROSS_CHECKS (env-check.ts). Отдельный файл — env-check.ts под храповиком
// размера (правило №10).
import type { CrossCheck } from './env-check';
import { POSTBOX_ENV_VARS } from './postbox-mail';

type Env = Record<string, string | undefined>;

const isSet = (env: Env, key: string): boolean => Boolean(env[key]?.trim());

/** «Задан хотя бы один ключ Postbox → dep тоже обязан быть задан». */
function postboxRequires(id: string, dep: string): CrossCheck {
  return {
    id,
    check: (env) => {
      const cause = POSTBOX_ENV_VARS.find((key) => isSet(env, key));
      if (!cause || isSet(env, dep)) return null;
      return `${cause} задан, но не задан(ы) ${dep}`;
    },
  };
}

export const EMAIL_CROSS_CHECKS: CrossCheck[] = [
  {
    // Подпись запроса собирается из пары ключей: с одним из двух почта
    // выключена целиком, а владелец думает, что настроил её.
    id: 'postboxKeysComeInPair',
    check: (env) => {
      const [set, ...rest] = POSTBOX_ENV_VARS.filter((key) => isSet(env, key));
      if (!set || rest.length > 0) return null;
      const missing = POSTBOX_ENV_VARS.find((key) => key !== set);
      return `${set} задан, но не задан(ы) ${missing} — без пары ключей письма не уходят`;
    },
  },
  // Инцидент 2026-09-15: пустой ADMIN_EMAIL при заданном ключе почты —
  // письма о записях молчали.
  postboxRequires('postboxRequiresAdminEmail', 'ADMIN_EMAIL'),
  postboxRequires('postboxRequiresEmailFrom', 'EMAIL_FROM'),
];
