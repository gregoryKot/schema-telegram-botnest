import type { Request, Response } from 'express';

// Ссылка из письма открывается переходом с чужого сайта (почтовик, webmail), а
// refresh-кука у нас SameSite=strict — на такой переход браузер её НЕ отдаёт,
// хотя сессия в браузере есть. Для привязки почты кука — единственное
// доказательство «это тот самый аккаунт» (A3), поэтому без обходного шага
// привязка ломалась бы у всех.
//
// Обход — промежуточная страница с meta-refresh: следующий переход начинает
// уже НАША страница, он same-site, и браузер куку отдаёт. Один отскок на
// ссылку: параметр `b=1` не даёт зациклиться, если сессии и правда нет.

export function shouldBounce(req: Request): boolean {
  return (
    req.headers['sec-fetch-site'] === 'cross-site' && req.query?.b === undefined
  );
}

export function sendBounce(req: Request, res: Response, base: string): void {
  const q = new URLSearchParams();
  for (const key of ['token', 'ticket']) {
    const v = req.query?.[key];
    if (typeof v === 'string' && v) q.set(key, v);
  }
  q.set('b', '1');
  const url = `${base.replace(/\/$/, '')}/api/auth/email/callback?${q.toString()}`;
  // Значение попадает в HTML-атрибут: экранируем всё, что может его закрыть.
  const safe = url
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
  res
    .status(200)
    .set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' })
    .type('html')
    .send(
      `<!doctype html><html lang="ru"><head><meta charset="utf-8">` +
        `<meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<meta http-equiv="refresh" content="0;url=${safe}">` +
        `<title>Привязка почты</title></head><body>` +
        `<p><a href="${safe}">Продолжить</a></p></body></html>`,
    );
}
