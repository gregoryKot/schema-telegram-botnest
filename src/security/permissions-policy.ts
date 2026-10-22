// Заголовок Permissions-Policy (аудит 2026-10-11, «Мелочь»): helmet 8 его не
// ставит, а без него любой скрипт на странице — включая встроенный iframe —
// может попросить камеру, микрофон или геопозицию. Сайту и мини-аппу ни одна
// из этих функций не нужна, поэтому они запрещены целиком (`=()`).
//
// Список запретов сверяется с кодом тестом на шве
// (permissions-policy.invariants.spec.ts): фронт, начавший звать запрещённое
// API, роняет jest, а не молча ломается у пользователя.
import type { NextFunction, Request, Response } from 'express';

/**
 * Запрещено целиком: ни наш код, ни встроенные iframe этим не пользуются.
 * Только имена, которые Chromium знает, — неизвестное имя даёт в консоли
 * «Unrecognized feature» на каждой странице. `payment` безопасен: Robokassa
 * открывается полным переходом, Payment Request API нигде не вызывается.
 * Датчики (accelerometer, gyroscope, magnetometer) Telegram SDK получает
 * через нативный мост, а не через Web API, поэтому запрет его не задевает.
 */
export const PERMISSIONS_POLICY_DENY = [
  'accelerometer',
  'bluetooth',
  'camera',
  'display-capture',
  'geolocation',
  'gyroscope',
  'hid',
  'magnetometer',
  'microphone',
  'midi',
  'payment',
  'serial',
  'usb',
] as const;

/**
 * Не запрещать: код этим пользуется. Запрет ломает функцию молча — ни ошибки
 * в логах, ни 4xx, просто кнопка перестаёт работать. Ключ — имя функции,
 * значение — кто ею пользуется.
 */
export const PERMISSIONS_POLICY_KEEP: Readonly<Record<string, string>> = {
  // Google One Tap идёт через FedCM: use_fedcm_for_prompt в useGoogleOneTap.
  'identity-credentials-get': 'webapp/src/hooks/useGoogleOneTap.ts',
  // «Поделиться»: navigator.share в shared/src/share и в обоих фронтах.
  'web-share': 'shared/src/share/shareImage.ts',
  // «Копировать»: navigator.clipboard в useCopyToClipboard и соседях.
  'clipboard-write': 'shared/src/utils/useCopyToClipboard.ts',
};

/** Значение заголовка: `accelerometer=(), bluetooth=(), …`. */
export function permissionsPolicyHeader(): string {
  return PERMISSIONS_POLICY_DENY.map((f) => `${f}=()`).join(', ');
}

/** Express-middleware: ставит Permissions-Policy на каждый ответ. */
export function permissionsPolicy() {
  const value = permissionsPolicyHeader();
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Permissions-Policy', value);
    next();
  };
}
