// Супервизор старта (deploy/entrypoint.mjs). Публичный порт держит front с первой
// секунды: пока приложение не подняло внутренний APP_PORT (окно старта, провал
// migrate, крашлуп) — клиент видит страницу техработ, а не generic-503 Amvera;
// приложение поднялось — front проксирует на него. Гоняем реальным процессом,
// подсовывая фейковые команды через env (RECOVER_CMD/MIGRATE_CMD/APP_CMD).
import { spawn, ChildProcess } from 'child_process';
import { createServer, Server } from 'net';
import { join } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { STARTUP_LAUNCH_ENV } from '../telegram/start-announce';

const ENTRY = join(process.cwd(), 'deploy', 'entrypoint.mjs');

// APP_PORT раньше был захардкожен (58124 и соседи). На общем CI-раннере такой
// порт может быть занят чужой джобой: фейковое «приложение» тогда не слушает,
// front проксировать некуда, и тест падает по таймауту — при полностью
// исправном коде. Просим ядро выдать свободный порт и сразу отпускаем его.
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => (port ? resolve(port) : reject(new Error('нет порта'))));
    });
  });
}

// Запускает entrypoint с фейковыми командами. front всегда поднимается на PORT=0
// (эфемерный) — возвращаем промис его порта (из лога) и промис exit-кода.
//
// detached: true — entrypoint.mjs сам ловит только SIGTERM/SIGINT и не
// пробрасывает SIGKILL своим детям (RECOVER_CMD/MIGRATE_CMD/APP_CMD) — их
// нельзя перехватить, поэтому они и не должны требовать этого от родителя.
// Без своей группы процессов afterEach ниже убивал бы только entrypoint.mjs,
// а `node -e "...listen(...)"` из последнего теста (нарочно вечный «апп»)
// оставался сиротой: он держит унаследованный (stdio по умолчанию 'pipe')
// файловый дескриptor stderr, и жест жив в этой строке пока другой конец не
// закрыт — Jest-процесс висел на этом хендле под --detectOpenHandles
// --forceExit=false (nightly.yml, джоба backend-flaky), а обычный `npx jest`
// это маскировал принудительным выходом воркера. detached: true делает
// entrypoint.mjs лидером своей группы — её и убиваем целиком.
function launch(env: Record<string, string>) {
  const proc: ChildProcess = spawn('node', [ENTRY], {
    env: { ...process.env, PORT: '0', ...env },
    detached: true,
  });
  // Весь stderr entrypoint'а (и унаследованный stderr APP_CMD) — для тестов,
  // которые проверяют строки `[entrypoint] …` и число запусков приложения.
  let logBuf = '';
  proc.stderr?.on('data', (d: Buffer) => (logBuf += d.toString()));
  const frontPort = new Promise<number>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('front не поднялся за 5с')),
      5000,
    );
    let buf = '';
    proc.stderr?.on('data', (d: Buffer) => {
      buf += d.toString();
      const m = buf.match(/поднят на порту (\d+)/);
      if (m) {
        clearTimeout(timer);
        resolve(Number(m[1]));
      }
    });
    proc.on('exit', () =>
      reject(new Error('процесс вышел раньше, чем поднялся front')),
    );
  });
  const exit = new Promise<number>((resolve) =>
    proc.on('exit', (c) => resolve(c ?? -1)),
  );
  return { proc, frontPort, exit, log: () => logBuf };
}

async function poll(url: string, want: RegExp, tries = 40): Promise<string> {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      if (want.test(text)) return text;
    } catch {
      /* front ещё не принимает — повторим */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`не дождались ${want} по ${url}`);
}

// Ждём, пока предикат над логом станет истинным. Бюджет большой (10 с): на
// загруженном раннере второго полного прогона jest спеки с настоящим процессом
// мигали по нехватке времени (docs/README.md, «Тесты и даты»).
async function waitLog(
  log: () => string,
  ok: (l: string) => boolean,
  budgetMs = 10000,
): Promise<string> {
  const until = Date.now() + budgetMs;
  while (Date.now() < until) {
    if (ok(log())) return log();
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`не дождались условия по логу:\n${log()}`);
}
const count = (l: string, re: RegExp) => (l.match(re) ?? []).length;

describe('entrypoint (супервизор старта)', () => {
  const alive: ChildProcess[] = [];
  afterEach(() => {
    while (alive.length) {
      const proc = alive.pop();
      if (!proc) continue;
      // -pid (не pid) — сигнал всей группе процессов (see launch(): detached:
      // true делает entrypoint.mjs её лидером), иначе RECOVER_CMD/MIGRATE_CMD/
      // APP_CMD-потомки переживают убитого родителя сиротами.
      try {
        if (proc.pid) process.kill(-proc.pid, 'SIGKILL');
        else proc.kill('SIGKILL');
      } catch {
        proc.kill('SIGKILL');
      }
    }
  });

  it('migrate deploy упал → front держит страницу техработ (200)', async () => {
    const { proc, frontPort } = launch({
      RECOVER_CMD: 'true',
      MIGRATE_CMD: 'exit 1',
      APP_PORT: String(await freePort()), // апстрима нет
    });
    alive.push(proc);
    const port = await frontPort;
    const res = await fetch(`http://127.0.0.1:${port}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('технические работы');
  }, 10000);

  // Щит, волна 3: DB-wait (deploy/wait-for-db.mjs) до этого теста был проверен
  // только как отдельная функция (wait-for-db.spec.ts) — а то, что САМ
  // entrypoint реально ждёт БД перед RECOVER_CMD/MIGRATE_CMD (а не просто
  // импортирует функцию и забывает её позвать), не проверял никто. Маркер-файл
  // — самый дешёвый способ доказать «RECOVER_CMD не выполнился», не разбирая
  // stdout процесса.
  it('БД недоступна → RECOVER_CMD/MIGRATE_CMD не запускаются, front держит техработы (DB-wait реально гейтит старт)', async () => {
    const marker = join(
      tmpdir(),
      `entrypoint-recover-marker-${process.pid}-${Date.now()}`,
    );
    if (existsSync(marker)) unlinkSync(marker);
    try {
      const { proc, frontPort } = launch({
        // Порт свободен и никто на нём не слушает — connect гарантированно
        // отказывает быстро (ECONNREFUSED). Бюджет ожидания БД — короткий
        // (150мс), а проверку маркера ниже делаем с большим запасом сверху,
        // чтобы гонка таймингов не давала ложно-зелёный результат.
        DATABASE_URL: `postgresql://u:p@127.0.0.1:${await freePort()}/db`,
        DB_WAIT_TIMEOUT_MS: '150',
        DB_WAIT_INTERVAL_MS: '50',
        DB_WAIT_CONNECT_MS: '50',
        RECOVER_CMD: `node -e "require('fs').writeFileSync('${marker}','x')"`,
        MIGRATE_CMD: 'true',
        APP_PORT: String(await freePort()),
      });
      alive.push(proc);
      const port = await frontPort;
      const text = await poll(
        `http://127.0.0.1:${port}/`,
        /технические работы/,
      );
      expect(text).toContain('технические работы');
      // Запас с большим отрывом от DB_WAIT_TIMEOUT_MS (150мс) — времени
      // достаточно, чтобы RECOVER_CMD успел отработать, если бы DB-wait его
      // не заблокировал.
      await new Promise((r) => setTimeout(r, 800));
      expect(existsSync(marker)).toBe(false);
    } finally {
      if (existsSync(marker)) unlinkSync(marker);
    }
  }, 10000);

  it('приложение крашится → после лимита перезапусков front держит техработы', async () => {
    const { proc, frontPort } = launch({
      RECOVER_CMD: 'true',
      MIGRATE_CMD: 'true',
      APP_CMD: 'exit 1',
      APP_PORT: String(await freePort()), // апстрим так и не поднимется
      STARTUP_MAX_FAILS: '2',
      STARTUP_BACKOFF_MS: '10',
    });
    alive.push(proc);
    const port = await frontPort;
    const text = await poll(`http://127.0.0.1:${port}/`, /технические работы/);
    expect(text).toContain('технические работы');
  }, 10000);

  // Аудит 2026-10-11 (infra#13): после лимита перезапусков супервизор парковался
  // НАВСЕГДА (процесс жив, restart-policy не срабатывает), и сбой, прошедший
  // сам, чинился только руками. Теперь — пауза и новая серия, front всё это
  // время отдаёт техработы. Короткая пауза через env, бюджет — waitLog.
  it('лимит исчерпан → процесс жив, front на техработах, после паузы идёт новая серия', async () => {
    const { proc, frontPort, log } = launch({
      RECOVER_CMD: 'true',
      MIGRATE_CMD: 'true',
      APP_CMD: 'echo APP-START >&2; exit 1',
      APP_PORT: String(await freePort()),
      STARTUP_MAX_FAILS: '2',
      STARTUP_BACKOFF_MS: '10',
      STARTUP_COOLDOWN_MS: '200',
      STARTUP_COOLDOWN_MAX_MS: '200',
    });
    alive.push(proc);
    const port = await frontPort;
    const first = await waitLog(log, (l) => /следующая серия через/.test(l));
    expect(first).toMatch(
      /лимит перезапусков исчерпан — техработы, следующая серия через 200 мс/,
    );
    expect(proc.exitCode).toBeNull();
    const out = await waitLog(log, (l) => count(l, /APP-START/g) >= 4);
    expect(count(out, /лимит перезапусков исчерпан/g)).toBeGreaterThanOrEqual(
      1,
    );
    expect(proc.exitCode).toBeNull();
    const text = await poll(`http://127.0.0.1:${port}/`, /технические работы/);
    expect(text).toContain('технические работы');
  }, 30000);

  it('БД не поднялась за отведённое время → повтор ожидания, а когда БД ожила — старт идёт дальше', async () => {
    const dbPort = await freePort();
    const marker = join(
      tmpdir(),
      `entrypoint-db-retry-marker-${process.pid}-${Date.now()}`,
    );
    if (existsSync(marker)) unlinkSync(marker);
    let db: Server | undefined;
    try {
      const { proc, frontPort, log } = launch({
        DATABASE_URL: `postgresql://u:p@127.0.0.1:${dbPort}/db`,
        DB_WAIT_TIMEOUT_MS: '150',
        DB_WAIT_INTERVAL_MS: '50',
        DB_WAIT_CONNECT_MS: '50',
        STARTUP_COOLDOWN_MS: '200',
        STARTUP_COOLDOWN_MAX_MS: '200',
        RECOVER_CMD: `node -e "require('fs').writeFileSync('${marker}','x')"`,
        MIGRATE_CMD: 'true',
        APP_CMD: 'echo APP-START >&2; exec sleep 30',
        APP_PORT: String(await freePort()),
      });
      alive.push(proc);
      await frontPort;
      await waitLog(log, (l) =>
        /БД не поднялась в отведённое время — техработы, следующая серия через/.test(
          l,
        ),
      );
      expect(existsSync(marker)).toBe(false);
      expect(proc.exitCode).toBeNull();
      // БД «ожила»: следующая серия обязана дойти до recover и приложения.
      db = createServer((c) => c.destroy());
      await new Promise<void>((r) => db?.listen(dbPort, '127.0.0.1', r));
      await waitLog(log, (l) => /APP-START/.test(l));
      expect(existsSync(marker)).toBe(true);
    } finally {
      db?.close();
      if (existsSync(marker)) unlinkSync(marker);
    }
  }, 30000);

  it('приложение подняло APP_PORT → front проксирует на него (не техработы)', async () => {
    const APP_PORT = String(await freePort());
    const { proc, frontPort } = launch({
      RECOVER_CMD: 'true',
      MIGRATE_CMD: 'true',
      // Приложение слушает process.env.PORT — entrypoint выставляет его в APP_PORT.
      APP_CMD:
        "node -e \"require('http').createServer((_q,s)=>s.end('APP-LIVE')).listen(process.env.PORT)\"",
      APP_PORT,
    });
    alive.push(proc);
    const port = await frontPort;
    const text = await poll(`http://127.0.0.1:${port}/`, /APP-LIVE/);
    expect(text).toBe('APP-LIVE');
  }, 10000);

  it('чистый старт (app завершился 0) → контейнер выходит 0', async () => {
    const { proc, exit } = launch({
      RECOVER_CMD: 'true',
      MIGRATE_CMD: 'true',
      APP_CMD: 'exit 0',
      APP_PORT: String(await freePort()),
    });
    alive.push(proc);
    expect(await exit).toBe(0);
  }, 10000);

  // Инцидент-класс аудита 2026-10-11 (r2-3#0): `if (shuttingDown || app.signal)
  // return` читал ЛЮБОЙ сигнал у ребёнка как штатную остановку. V8 при heap-OOM
  // (SIGABRT), OOM-killer хоста (SIGKILL), нативный модуль (SIGSEGV) → прод
  // навсегда на техработах: ни перезапуска, ни строки в логе, а HEALTHCHECK
  // зелёный (front отдаёт 200). Ребёнок убивает сам себя настоящим сигналом,
  // как это делает ядро, — шов «child.on('exit', (code, signal))» проходит
  // настоящий процесс, а не подставленный объект.
  describe.each([
    ['SIGKILL (OOM-killer хоста)', 'kill -9 $$', 'SIGKILL'],
    ['SIGABRT (V8 heap-OOM)', 'kill -ABRT $$', 'SIGABRT'],
    ['SIGSEGV (нативный модуль)', 'kill -SEGV $$', 'SIGSEGV'],
    ['SIGTERM не от entrypoint', 'kill -TERM $$', 'SIGTERM'],
  ])('ребёнок убит сигналом: %s', (_name, kill, sig) => {
    const appCmd = `echo APP-START >&2; sleep 0.2; ${kill}`;

    it('перезапускается с логом и бэкоффом, после лимита — техработы', async () => {
      const { proc, frontPort, log } = launch({
        RECOVER_CMD: 'true',
        MIGRATE_CMD: 'true',
        APP_CMD: appCmd,
        APP_PORT: String(await freePort()),
        STARTUP_MAX_FAILS: '3',
        STARTUP_BACKOFF_MS: '10',
      });
      alive.push(proc);
      const port = await frontPort;
      const out = await waitLog(log, (l) => /лимит перезапусков/.test(l));
      expect(count(out, /APP-START/g)).toBe(3);
      expect(
        count(out, new RegExp(`приложение убито сигналом ${sig} `, 'g')),
      ).toBe(3);
      expect(out).toMatch(/ranMs=\d+, fails=3\/3/);
      // Лимит исчерпан → процесс жив и отдаёт техработы (а не молча умер).
      expect(proc.exitCode).toBeNull();
      const text = await poll(
        `http://127.0.0.1:${port}/`,
        /технические работы/,
      );
      expect(text).toContain('технические работы');
    }, 30000);

    // Контроль окна: падения реже окна — не крашлуп, лимита нет. Ребёнок
    // живёт 200 мс, окно 100 мс: прежнее падение всегда старше окна.
    it('падения реже окна (STARTUP_CRASH_WINDOW_MS) не копятся, лимита нет', async () => {
      const { proc, frontPort, log } = launch({
        RECOVER_CMD: 'true',
        MIGRATE_CMD: 'true',
        APP_CMD: appCmd,
        APP_PORT: String(await freePort()),
        STARTUP_MAX_FAILS: '2',
        STARTUP_BACKOFF_MS: '10',
        STARTUP_CRASH_WINDOW_MS: '100',
      });
      alive.push(proc);
      await frontPort;
      const out = await waitLog(log, (l) => count(l, /APP-START/g) >= 4);
      expect(out).not.toMatch(/лимит перезапусков/);
      expect(out).toMatch(`приложение убито сигналом ${sig} (ranMs=`);
      expect(out).not.toMatch(/fails=2\/2/);
    }, 30000);
  });

  // Аудит 2026-10, «Супервизор контейнера»: прогон дольше STARTUP_HEALTHY_MS
  // (минута) обнулял счётчик — приложение, падающее каждые 61 с, жило на
  // «fails=1/3» вечно: ни лимита, ни техработ, ни паузы, а каждый круг слал
  // владельцу DM о старте. Две ручки нужны, чтобы тест различал старое и новое:
  // по старому порогу (200 мс) каждый прогон «здоровый», по окну (60 с) три
  // падения подряд — крашлуп.
  describe('крашлуп с «долгими» прогонами (окно падений)', () => {
    const slowCrash = {
      RECOVER_CMD: 'true',
      MIGRATE_CMD: 'true',
      APP_CMD: 'echo APP-START >&2; sleep 0.3; exit 1',
      STARTUP_HEALTHY_MS: '200', // прежний порог «здорового» прогона
      STARTUP_CRASH_WINDOW_MS: '60000',
      STARTUP_BACKOFF_MS: '10',
    };

    it('три падения за окно → лимит и техработы, процесс жив', async () => {
      const { proc, frontPort, log } = launch({
        ...slowCrash,
        APP_PORT: String(await freePort()),
        STARTUP_MAX_FAILS: '3',
      });
      alive.push(proc);
      const port = await frontPort;
      const out = await waitLog(log, (l) => /лимит перезапусков/.test(l));
      expect(count(out, /APP-START/g)).toBe(3);
      expect(out).toMatch(/ranMs=\d+, fails=3\/3/);
      expect(proc.exitCode).toBeNull();
      const text = await poll(
        `http://127.0.0.1:${port}/`,
        /технические работы/,
      );
      expect(text).toContain('технические работы');
    }, 30000);

    it('серии подряд без прогона дольше окна → пауза растёт, а не сбрасывается', async () => {
      const { proc, frontPort, log } = launch({
        ...slowCrash,
        APP_PORT: String(await freePort()),
        STARTUP_MAX_FAILS: '2',
        STARTUP_COOLDOWN_MS: '100',
        STARTUP_COOLDOWN_MAX_MS: '10000',
      });
      alive.push(proc);
      await frontPort;
      const out = await waitLog(
        log,
        (l) => count(l, /следующая серия через/g) >= 3,
        20000,
      );
      const pauses = [...out.matchAll(/следующая серия через (\d+) мс/g)].map(
        (m) => Number(m[1]),
      );
      expect(pauses.slice(0, 3)).toEqual([100, 200, 400]);
    }, 30000);
  });

  // Номер запуска (STARTUP_LAUNCH) отличает DM о деплое от DM о перезапуске
  // (src/telegram/start-announce.ts). Имя — та же константа, что читает
  // приложение: обе стороны шва держатся одной строки.
  it('номер запуска доходит до приложения и растёт через серии', async () => {
    const { proc, frontPort, log } = launch({
      RECOVER_CMD: 'true',
      MIGRATE_CMD: 'true',
      APP_CMD: `echo LAUNCH=$${STARTUP_LAUNCH_ENV} >&2; exit 1`,
      APP_PORT: String(await freePort()),
      STARTUP_MAX_FAILS: '2',
      STARTUP_BACKOFF_MS: '10',
      STARTUP_COOLDOWN_MS: '50',
      STARTUP_COOLDOWN_MAX_MS: '50',
    });
    alive.push(proc);
    await frontPort;
    const out = await waitLog(log, (l) => count(l, /LAUNCH=\d+/g) >= 4);
    const launches = [...out.matchAll(/LAUNCH=(\d+)/g)].map((m) => m[1]);
    expect(launches.slice(0, 4)).toEqual(['1', '2', '3', '4']);
    expect(out).toMatch(/LAUNCH=2[\s\S]*следующая серия через[\s\S]*LAUNCH=3/);
  }, 30000);

  it('контроль: SIGTERM самому entrypoint → приложение гасится, выход 0, без перезапуска и без «убито»', async () => {
    const { proc, frontPort, exit, log } = launch({
      RECOVER_CMD: 'true',
      MIGRATE_CMD: 'true',
      APP_CMD: 'echo APP-START >&2; exec sleep 30',
      APP_PORT: String(await freePort()),
      STARTUP_MAX_FAILS: '3',
      STARTUP_BACKOFF_MS: '10',
    });
    alive.push(proc);
    await frontPort;
    await waitLog(log, (l) => /APP-START/.test(l));
    proc.kill('SIGTERM');
    expect(await exit).toBe(0);
    const out = log();
    expect(count(out, /APP-START/g)).toBe(1);
    expect(out).not.toMatch(/убито сигналом|приложение упало/);
  }, 30000);
});
