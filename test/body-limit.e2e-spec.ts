// Потолок размера тела запроса — ЗАМЕР, а не рассуждение (аудит 2026-07-20, L2).
//
// Находка аудита предполагала, что `app.use(json({limit:'256kb'}))` в main.ts —
// мёртвая строка: NestFactory.create якобы уже поставил свой парсер на 100 КБ,
// а второй парсер пропускает разобранное тело. Замер показал обратное: потолок
// держался на 262144 байтах, но держался случайно — Nest ставит парсер в
// `init()` (после наших `app.use`) и пропускает слой, если в стеке уже есть
// функция с таким же именем. Обе детали чужие, и обе молча отключили бы потолок
// при перестановке строк в bootstrap.
//
// Поэтому спек пинит три вещи сразу:
//   1. ЧИСЛО: где именно проходит граница (а не «где-то между 100 и 256 КБ»);
//   2. СТАТУС: тело сверх лимита — 413, а не 500 (см. п. 3);
//   3. КАНАЛ: превышение не уходит админу в DM. AlertLogger переопределяет
//      только `error`, поэтому проверяем уровень лога: `warn` — да, `error` —
//      нет. До починки клиентская ошибка считалась аварией сервера и выжигала
//      общий бюджет алертов (15/мин на все подсистемы), заглушая настоящие.
//
// Запрос идёт на НЕсуществующий путь намеренно: парсер тела стоит в стеке до
// роутера, поэтому его граница не зависит ни от роута, ни от гарда, ни от DTO.
// 404 от роутера читается как «парсер пропустил тело дальше».
import { INestApplication, Logger } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp } from './e2e-support/build-test-app';
import { BODY_LIMIT_BYTES } from '../src/infra/body-limit';
import { MAX_PHOTO_BYTES } from '../src/site-content/site-content-admin.controller';

describe('e2e: лимит размера тела запроса (аудит 2026-07-20, L2)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await buildTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  /** JSON-тело ровно `bytes` байт: `{"pad":"xxx…"}` — обёртка занимает 10. */
  function jsonBodyOfExactly(bytes: number): string {
    const body = `{"pad":"${'x'.repeat(bytes - 10)}"}`;
    // Страховка от «тест проверяет не то, что думает»: если обёртка изменится,
    // падаем здесь, а не выдаём зелёный прогон на теле другого размера.
    expect(Buffer.byteLength(body)).toBe(bytes);
    return body;
  }

  const postJson = (body: string) =>
    request(app.getHttpServer())
      .post('/api/__body-limit-probe__')
      .set('Content-Type', 'application/json')
      .send(body);

  it('тело ровно в лимит (262144 байта) доходит до роутера', async () => {
    const res = await postJson(jsonBodyOfExactly(BODY_LIMIT_BYTES));
    // 404 — ответ роутера: тело разобрано, до маршрутизации дошло.
    expect(res.status).toBe(404);
  });

  it('тело на один байт сверх лимита → 413 (а не 500)', async () => {
    const res = await postJson(jsonBodyOfExactly(BODY_LIMIT_BYTES + 1));
    expect(res.status).toBe(413);
    expect(res.body).toEqual({
      statusCode: 413,
      error: 'Client Error',
      message: 'Слишком большой запрос',
    });
  });

  it('штатный потолок Nest (100 КБ) выключен — 150 КБ проходят', async () => {
    // Контрольный замер против самой находки L2: если `bodyParser: false` в
    // main.ts когда-нибудь пропадёт и Nest снова поставит свой парсер первым,
    // граница уедет на 102400 байт и этот тест покраснеет.
    const res = await postJson(jsonBodyOfExactly(150 * 1024));
    expect(res.status).toBe(404);
  });

  it('urlencoded держит тот же потолок', async () => {
    const form = (chars: number) =>
      request(app.getHttpServer())
        .post('/api/__body-limit-probe__')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(`pad=${'x'.repeat(chars)}`);

    expect((await form(200 * 1024)).status).toBe(404);
    expect((await form(300 * 1024)).status).toBe(413);
  });

  it('самое длинное законное тело — фото главной — проходит с запасом', async () => {
    // PATCH /api/site-content/admin/hero-photo принимает data-URI до
    // MAX_PHOTO_BYTES. Это максимум по проекту, и именно от него посчитан
    // потолок (src/infra/body-limit.ts). Проверяем на парсере, без ключа
    // админа: интересует граница тела, а не авторизация.
    const dataUri = `data:image/jpeg;base64,${'A'.repeat(MAX_PHOTO_BYTES - 23)}`;
    expect(dataUri.length).toBe(MAX_PHOTO_BYTES);
    const body = JSON.stringify({ dataUri });

    expect(Buffer.byteLength(body)).toBeLessThan(BODY_LIMIT_BYTES);
    const res = await postJson(body);
    expect(res.status).not.toBe(413);
  });

  it('превышение лимита не уходит в канал алертов (warn, не error)', async () => {
    // AlertLogger (src/logger/alert.logger.ts) переопределяет ТОЛЬКО `error` —
    // уровень лога здесь и есть «уйдёт админу в DM или нет».
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    try {
      const res = await postJson(jsonBodyOfExactly(BODY_LIMIT_BYTES + 1));

      expect(res.status).toBe(413);
      expect(errorSpy).not.toHaveBeenCalled();
      // Событие при этом не проглочено: в stdout строка есть.
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('PayloadTooLargeError'),
      );
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('сообщение самой ошибки клиенту не отдаётся', async () => {
    const res = await postJson(jsonBodyOfExactly(BODY_LIMIT_BYTES + 1));
    // http-errors кладёт в message «request entity too large» и размеры —
    // внутренние детали лимита клиенту не нужны (та же причина, что у
    // PrismaExceptionFilter: ответ собирается из заранее заданных фраз).
    expect(JSON.stringify(res.body)).not.toMatch(/entity|limit|\d{6}/i);
  });
});
