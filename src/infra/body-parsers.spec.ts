// Парсеры тела на настоящем express: форма разбирается только на путях из
// FORM_BODY_PATHS (Robokassa ResultURL), на остальных тело пустое — иначе
// HTML-форма с чужого сайта попадает в DTO (login-CSRF, security#6).
import express from 'express';
import request from 'supertest';
import { FORM_BODY_PATHS, installBodyParsers } from './body-parsers';

function buildApp() {
  const app = express();
  installBodyParsers(app);
  app.post(/.*/, (req, res) => {
    res.json({ body: (req.body ?? null) as unknown });
  });
  return app;
}

describe('installBodyParsers', () => {
  const app = buildApp();

  it('единственный путь формы — ResultURL Robokassa', () => {
    expect(FORM_BODY_PATHS).toEqual(['/api/payment/result']);
  });

  it('форма на /api/payment/result разбирается (так шлёт Robokassa)', async () => {
    const res = await request(app)
      .post('/api/payment/result')
      .type('form')
      .send('OutSum=3000.00&InvId=17&SignatureValue=abc');
    expect(res.body.body).toEqual({
      OutSum: '3000.00',
      InvId: '17',
      SignatureValue: 'abc',
    });
  });

  // Контрольный образец: тот же заголовок и то же тело, но путь — ручка,
  // выдающая сессию. Парсер обязан промолчать.
  it.each([
    '/api/auth/telegram/webapp',
    '/api/auth/max/webapp',
    '/api/auth/ticket/poll',
    '/api/payment/result-other',
  ])('форма на %s не разбирается', async (path) => {
    const res = await request(app)
      .post(path)
      .type('form')
      .send('initData=x&deviceCode=y');
    const body = res.body.body as Record<string, unknown> | null;
    expect(body?.initData).toBeUndefined();
    expect(body?.deviceCode).toBeUndefined();
  });

  it('JSON разбирается на любом пути', async () => {
    const res = await request(app)
      .post('/api/auth/telegram/webapp')
      .send({ initData: 'x' });
    expect(res.body.body).toEqual({ initData: 'x' });
  });
});
