// Находка аудита 2026-10-11, backend#29: заметка сессии терапевта на 6000
// знаков отвечала 201 и теряла хвост — DTO пропускал 10 000, а контроллер
// резал `.slice(0, 5000)`. Тот же класс жил в трекере (500), дневниках
// (2000/500), практиках (200), картах режимов (120/80/8) и заявке (100/500).
//
// Юнит с прямым вызовом контроллера DTO не исполняет — ValidationPipe там
// нет, поэтому «лимит» проверялся мимо шва. Этот спек идёт через настоящий
// AppModule и настоящий ValidationPipe (build-test-app.ts; на живом Postgres
// гоняется второй раз в джобе `migrations`): ровно на пределе — сохранено
// ЦЕЛИКОМ (читаем обратно), на символ больше — 400, и ничего не записано.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp, TestApp } from './e2e-support/build-test-app';
import { signAccessToken } from './e2e-support/jwt';
import { cleanupOwnershipFixtures } from './e2e-support/cleanup-fixtures';
import {
  BOOKING_CONTACT_MAX,
  BOOKING_MESSAGE_MAX,
  BOOKING_NAME_MAX,
  BOOKING_SOURCE_MAX,
  CUSTOM_MODE_NAME_MAX,
  DAY_NOTE_MAX,
  DIARY_FIELD_MAX,
  MODE_MAP_TITLE_MAX,
  PRACTICE_TEXT_MAX,
  SESSION_NOTE_MAX,
} from '../src/utils/text-limits';

describe('e2e: лимиты текста — один в DTO, превышение → 400, хвост не теряется', () => {
  let app: INestApplication;
  let prisma: TestApp['prisma'];

  const T = 4_200_000_000_000_001n; // терапевт
  const C = 4_200_000_000_000_002n; // его клиент
  const U = 4_200_000_000_000_003n; // обычный пользователь
  const C_ID = Number(C);
  const ALL = [T, C, U];

  function agentAs(userId: bigint) {
    const token = signAccessToken(userId, process.env.JWT_SECRET as string);
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
    return {
      get: (url: string) => auth(request(app.getHttpServer()).get(url)),
      post: (url: string, body: object = {}) =>
        auth(request(app.getHttpServer()).post(url)).send(body),
      patch: (url: string, body: object = {}) =>
        auth(request(app.getHttpServer()).patch(url)).send(body),
    };
  }

  // Строка длины n, у которой хвост различим: последний символ — «Я».
  const ofLen = (n: number) => 'а'.repeat(n - 1) + 'Я';

  beforeAll(async () => {
    ({ app, prisma } = await buildTestApp());
    await cleanupOwnershipFixtures(prisma, ALL);
    await prisma.user.create({ data: { id: T, role: 'THERAPIST' } });
    await prisma.user.create({ data: { id: C, role: 'CLIENT' } });
    await prisma.user.create({ data: { id: U } });
    const invite = await agentAs(T).post('/api/therapy/invite');
    expect(invite.status).toBeLessThan(300);
    const join = await agentAs(C).post('/api/therapy/join', {
      code: invite.body.code,
    });
    expect(join.status).toBeLessThan(300);
  });

  afterAll(async () => {
    await cleanupOwnershipFixtures(prisma, ALL);
    await app.close();
  });

  describe('заметка терапевта по сессии (POST /api/therapy/notes/:clientId)', () => {
    const url = `/api/therapy/notes/${C_ID}`;

    it('шесть тысяч знаков (раньше резалось до 5000) читаются обратно целиком', async () => {
      const text = ofLen(6000);
      const created = await agentAs(T).post(url, { date: '2026-10-11', text });
      expect(created.status).toBe(201);
      expect(created.body.text).toBe(text);
      const list = await agentAs(T).get(url);
      expect(list.body.map((n: { text: string }) => n.text)).toContain(text);
    });

    it('ровно на пределе — сохранено целиком; на символ больше — 400 и записи нет', async () => {
      const atLimit = ofLen(SESSION_NOTE_MAX);
      const ok = await agentAs(T).post(url, {
        date: '2026-10-12',
        text: atLimit,
      });
      expect(ok.status).toBe(201);
      expect(ok.body.text).toHaveLength(SESSION_NOTE_MAX);

      const before = (await agentAs(T).get(url)).body.length;
      const over = await agentAs(T).post(url, {
        date: '2026-10-13',
        text: ofLen(SESSION_NOTE_MAX + 1),
      });
      expect(over.status).toBe(400);
      expect(JSON.stringify(over.body)).toContain('text');
      expect((await agentAs(T).get(url)).body).toHaveLength(before);
    });
  });

  describe('заметка к дню в трекере (POST /api/note)', () => {
    it('ровно предел (500) читается обратно целиком', async () => {
      const text = ofLen(DAY_NOTE_MAX);
      const saved = await agentAs(U).post('/api/note', {
        date: '2026-10-11',
        text,
        tags: [],
      });
      expect(saved.status).toBe(201);
      const got = await agentAs(U).get('/api/note?date=2026-10-11');
      expect(got.body.text).toBe(text);
    });

    it('на символ больше предела — 400, прежняя заметка не затёрта', async () => {
      const prev = ofLen(DAY_NOTE_MAX);
      expect(
        (
          await agentAs(U).post('/api/note', {
            date: '2026-10-12',
            text: prev,
            tags: [],
          })
        ).status,
      ).toBe(201);
      const over = await agentAs(U).post('/api/note', {
        date: '2026-10-12',
        text: ofLen(DAY_NOTE_MAX + 1),
        tags: [],
      });
      expect(over.status).toBe(400);
      const got = await agentAs(U).get('/api/note?date=2026-10-12');
      expect(got.body.text).toBe(prev);
    });
  });

  describe('дневники (POST /api/diary/*)', () => {
    it('схема: поле на 3000 знаков (раньше 2000) читается целиком; на пределе + 1 — 400', async () => {
      const long = ofLen(3000);
      const ok = await agentAs(U).post('/api/diary/schema', {
        trigger: long,
        thoughts: long,
        emotions: [],
        schemaIds: [],
      });
      expect(ok.status).toBe(201);
      const list = await agentAs(U).get('/api/diary/schema');
      expect(list.body[0].trigger).toBe(long);
      expect(list.body[0].thoughts).toBe(long);

      for (const field of ['trigger', 'thoughts']) {
        const res = await agentAs(U).post('/api/diary/schema', {
          trigger: 'т',
          emotions: [],
          schemaIds: [],
          [field]: ofLen(DIARY_FIELD_MAX + 1),
        });
        expect(res.status).toBe(400);
      }
    });

    it('режим: situation и healthyResponse длиннее 2000 читаются целиком; предел + 1 — 400', async () => {
      const long = ofLen(2500);
      const ok = await agentAs(U).post('/api/diary/mode', {
        modeId: 'vulnerable_child',
        situation: long,
        healthyResponse: long,
      });
      expect(ok.status).toBe(201);
      const list = await agentAs(U).get('/api/diary/mode');
      expect(list.body[0].situation).toBe(long);
      expect(list.body[0].healthyResponse).toBe(long);

      for (const field of ['situation', 'healthyResponse']) {
        const res = await agentAs(U).post('/api/diary/mode', {
          modeId: 'vulnerable_child',
          situation: 'с',
          [field]: ofLen(DIARY_FIELD_MAX + 1),
        });
        expect(res.status).toBe(400);
      }
    });

    it('благодарность: пункт на 700 знаков (раньше 500) читается целиком; предел + 1 — 400', async () => {
      const long = ofLen(700);
      const ok = await agentAs(U).post('/api/diary/gratitude', {
        date: '2026-10-11',
        items: [long, 'короткий'],
      });
      expect(ok.status).toBe(201);
      const list = await agentAs(U).get('/api/diary/gratitude');
      expect(list.body[0].items).toEqual([long, 'короткий']);

      const over = await agentAs(U).post('/api/diary/gratitude', {
        date: '2026-10-12',
        items: [ofLen(DIARY_FIELD_MAX + 1)],
      });
      expect(over.status).toBe(400);
    });
  });

  describe('практика в плане (POST /api/practices)', () => {
    it('ровно 200 — сохранено целиком; 201 — 400', async () => {
      const text = ofLen(PRACTICE_TEXT_MAX);
      const ok = await agentAs(U).post('/api/practices', {
        needId: 'attachment',
        text,
      });
      expect(ok.status).toBe(201);
      const list = await agentAs(U).get('/api/practices?needId=attachment');
      expect(list.body.map((p: { text: string }) => p.text)).toContain(text);
      const over = await agentAs(U).post('/api/practices', {
        needId: 'attachment',
        text: ofLen(PRACTICE_TEXT_MAX + 1),
      });
      expect(over.status).toBe(400);
    });
  });

  describe('карты режимов терапевта', () => {
    const maps = `/api/therapy/mode-maps/${C_ID}`;

    it('название: ровно предел — сохранено целиком; предел + 1 — 400 (и при создании, и при переименовании)', async () => {
      const title = ofLen(MODE_MAP_TITLE_MAX);
      const ok = await agentAs(T).post(maps, { title, kind: 'personality' });
      expect(ok.status).toBe(201);
      expect(ok.body.title).toBe(title);

      const over = await agentAs(T).post(maps, {
        title: ofLen(MODE_MAP_TITLE_MAX + 1),
      });
      expect(over.status).toBe(400);

      const rename = await agentAs(T).patch(
        `/api/therapy/mode-maps/map/${ok.body.id}`,
        {
          title: ofLen(MODE_MAP_TITLE_MAX + 1),
        },
      );
      expect(rename.status).toBe(400);
    });

    it('свой режим: имя ровно 80 — целиком; 81 — 400; значок длиннее 8 — 400', async () => {
      const name = ofLen(CUSTOM_MODE_NAME_MAX);
      const ok = await agentAs(T).post('/api/therapy/custom-modes', { name });
      expect(ok.status).toBe(201);
      expect(ok.body.name).toBe(name);

      const longName = await agentAs(T).post('/api/therapy/custom-modes', {
        name: ofLen(CUSTOM_MODE_NAME_MAX + 1),
      });
      expect(longName.status).toBe(400);
      const longEmoji = await agentAs(T).post('/api/therapy/custom-modes', {
        name: 'Критик',
        emoji: '🔥'.repeat(9),
      });
      expect(longEmoji.status).toBe(400);
    });
  });

  describe('заявка с сайта (POST /api/booking, публичный)', () => {
    it.each([
      ['name', BOOKING_NAME_MAX],
      ['contact', BOOKING_CONTACT_MAX],
      ['message', BOOKING_MESSAGE_MAX],
      ['source', BOOKING_SOURCE_MAX],
    ])(
      '%s длиннее %i — 400, а не 200 с урезанной карточкой админу',
      async (field, max) => {
        const res = await request(app.getHttpServer())
          .post('/api/booking')
          .send({ name: 'Имя', contact: '@c', [field]: ofLen(max + 1) });
        expect(res.status).toBe(400);
      },
    );
  });
});
