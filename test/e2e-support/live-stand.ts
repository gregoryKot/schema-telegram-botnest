// Живой стенд для e2e-browser/live (проход связи клиент↔терапевт через браузер
// по настоящему бэкенду): настоящий AppModule на живом Postgres (E2E_REAL_DB=1)
// слушает :3000, пока не появится файл STAND_STOP_FILE; :3001/login/<id> ставит
// настоящую refresh-куку и ведёт на сайт. Пользователи стенда — фиксированные
// id (STAND_USERS), чистятся при старте и при остановке. Это не спек CI: имя
// без `.e2e-spec`, джоба его не подхватит; кандидат в nightly — docs/open/ci-tests.md.
//
// Запуск (три терминала, из корня репозитория):
//   createdb therapy_qa
//   export E2E_REAL_DB=1 DATABASE_URL=postgresql://localhost:5432/therapy_qa
//   npx prisma migrate deploy && npx prisma generate
//   STAND_STOP_FILE=/tmp/stand.stop npx jest --config test/jest-e2e.json --runInBand \
//     --testRegex 'e2e-support/live-stand\.ts$'
//   (cd webapp && VITE_BOT_USERNAME=SchemeHappensBot npx vite build && npx vite preview --config vite.live.config.ts)
//   PW_CHROMIUM_PATH=<путь к Chromium, если ревизия не совпадает> npx playwright test -c e2e-browser/live/playwright.config.ts
//   остановить стенд: touch /tmp/stand.stop
import { existsSync } from 'fs';
import { createServer } from 'http';
import { buildTestApp } from './build-test-app';
import { cleanupOwnershipFixtures } from './cleanup-fixtures';
import { AuthService } from '../../src/auth/auth.service';
import { REFRESH_COOKIE } from '../../src/auth/auth-http.util';

const BASE = 4_300_000_000_000n;
export const STAND_USERS = {
  T: BASE + 1n, // терапевт
  T2: BASE + 2n, // второй терапевт
  C: BASE + 3n, // клиент с Telegram
  C2: BASE + 4n, // второй клиент с Telegram
  W: 1_000_000_000_000_042n, // веб-клиент (id ≥ 1e15, без Telegram)
};
const ALL = Object.values(STAND_USERS);
const STOP = process.env.STAND_STOP_FILE ?? '/tmp/stand.stop';
jest.setTimeout(12 * 3_600_000);

describe('stand', () => {
  it('serves until stop file appears', async () => {
    const { app, prisma } = await buildTestApp();
    await cleanupOwnershipFixtures(prisma, ALL);
    // Онбординг пройден: иначе оверлеи «ты/вы», согласия и «первый раз» перехватывают клики.
    const seen = {
      addressForm: 'ty',
      disclaimerAccepted: true,
      onboardingV1Done: true,
      onboardingV2Done: true,
      trackerOnboardingDone: true,
      practicesOnboardingDone: true,
    };
    await prisma.user.create({
      data: {
        id: STAND_USERS.T,
        role: 'THERAPIST',
        therapistMode: true,
        firstName: 'Анна',
        ...seen,
      },
    });
    await prisma.user.create({
      data: {
        id: STAND_USERS.T2,
        role: 'THERAPIST',
        therapistMode: true,
        firstName: 'Борис',
        ...seen,
      },
    });
    await prisma.user.create({
      data: { id: STAND_USERS.C, role: 'CLIENT', firstName: 'Мария', ...seen },
    });
    await prisma.user.create({
      data: { id: STAND_USERS.C2, role: 'CLIENT', firstName: 'Олег', ...seen },
    });
    await prisma.user.create({
      data: { id: STAND_USERS.W, role: 'CLIENT', firstName: 'Вера', ...seen },
    });
    await app.listen(3000);
    // Вход на стенде: GET :3001/login/<id> ставит настоящую refresh-куку (host
    // 127.0.0.1 общий для всех портов) и ведёт в кабинет на dev-сервере :5174.
    const auth = app.get(AuthService);
    const login = createServer((req, res) => {
      const m = /^\/login\/(\d+)/.exec(req.url ?? '');
      if (!m) {
        res.statusCode = 404;
        res.end();
        return;
      }
      auth
        .issueTokens(BigInt(m[1]), '127.0.0.1', 'stand')
        .then((t) => {
          res.setHeader(
            'Set-Cookie',
            `${REFRESH_COOKIE}=${t.refreshToken}; Path=/api/auth; HttpOnly; SameSite=Strict; Secure; Max-Age=2592000`,
          );
          res.setHeader('Location', 'http://localhost:5174/today');
          res.statusCode = 302;
          res.end();
        })
        .catch((e) => {
          res.statusCode = 500;
          res.end(String(e));
        });
    });
    // Без host: dev-сервер Vite слушает только [::1], а Chromium ходит на localhost по IPv6.
    await new Promise<void>((r) => login.listen(3001, r));

    console.log('STAND READY on :3000 (login :3001)');
    while (!existsSync(STOP)) await new Promise((r) => setTimeout(r, 1000));
    login.close();
    if (process.env.STAND_KEEP_DATA !== '1')
      await cleanupOwnershipFixtures(prisma, ALL);
    await app.close();
  });
});
