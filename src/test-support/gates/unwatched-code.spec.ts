// Тест гейта check-unwatched-code.mjs — продолжение класса из инцидента
// 2026-08-08 (см. public-scripts.spec.ts): `webapp/public/max-bridge.js`
// сломал вход всем пользователям Telegram на 5 суток, потому что был вне
// поля зрения coverage/гейтов/тестов. check-dead-files.mjs и
// check-public-scripts.mjs закрывают только СВОИ деревья/расширения — этот
// гейт нашёл ту же дыру СОСЕДОМ с ними: `deploy/threads-relay/worker.js`
// (Cloudflare Worker с AUTH-сверкой секрета) не видел ни один из них.
//
// Проверяем ОБА исхода: гейт краснеет на непокрытом коде вне watched-деревьев
// и зеленеет, когда на файл есть тест или он в бейслайне. Скрипт читает
// список файлов через `git ls-files` — песочница поднимается с git:true.
import { runGate } from './gate-sandbox';

const UNWATCHED = "const secret = 'not-a-real-secret';\nexports.check = secret;\n";

// gate-sandbox копирует САМ ПРОВЕРЯЕМЫЙ скрипт в `<tmp>/scripts/…` — а
// scripts/ не watched-дерево (это буквально предмет проверки: скрипты в
// scripts/ обязаны быть под тестом не меньше, чем deploy/). Значит копия
// гейта сама попадает в его же scope песочницы и в «зелёных» фикстурах
// нуждается либо в упоминании, либо в бейслайне — иначе тест фейлится не
// из-за сценария, а из-за самого механизма песочницы. В реальном репозитории
// этой сложности нет: `check-unwatched-code.mjs` покрыт этим же файлом
// (текущий спек буквально зовёт `runGate('check-unwatched-code.mjs', …)`).
const SELF_MENTION = '// смотрит на себя: check-unwatched-code.mjs\n';
const SELF_BASELINE = {
  'scripts/check-unwatched-code.mjs': 'копия проверяемого скрипта в песочнице теста',
};

describe('check-unwatched-code.mjs', () => {
  it('исполняемый файл вне watched-деревьев без единого теста — exit 1, путь в stderr', () => {
    const res = runGate(
      'check-unwatched-code.mjs',
      {
        'scripts/unwatched-code-baseline.json': '{}',
        'deploy/threads-relay/worker.js': UNWATCHED,
      },
      { git: true },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('исполняемый код вне наблюдаемых деревьев');
    expect(res.stderr).toContain('deploy/threads-relay/worker.js');
  });

  it('тот же файл, но упомянутый в спеке из test/ — гейт зелёный', () => {
    const res = runGate(
      'check-unwatched-code.mjs',
      {
        // Пусто, а не SELF_BASELINE: копия гейта здесь УПОМЯНУТА (SELF_MENTION
        // ниже) — если ещё и баселинить, запись станет протухшей (мешать
        // упоминание с бейслайном для одного файла в одной фикстуре нельзя).
        'scripts/unwatched-code-baseline.json': '{}',
        'deploy/threads-relay/worker.js': UNWATCHED,
        'test/e2e-support/relay.spec.ts':
          "import { readFileSync } from 'fs';\nconst src = readFileSync('deploy/threads-relay/worker.js', 'utf8');\nit('исполняется', () => src);\n" +
          SELF_MENTION,
      },
      { git: true },
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('все под тестом');
  });

  it('нарушение внесено в бейслайн с причиной — гейт зелёный', () => {
    const res = runGate(
      'check-unwatched-code.mjs',
      {
        'scripts/unwatched-code-baseline.json': JSON.stringify({
          'deploy/threads-relay/worker.js':
            'осознанное временное исключение, причина указана вручную',
          ...SELF_BASELINE,
        }),
        'deploy/threads-relay/worker.js': UNWATCHED,
      },
      { git: true },
    );
    expect(res.status).toBe(0);
  });

  it('запись бейслайна протухла (тест появился) — exit 1', () => {
    const res = runGate(
      'check-unwatched-code.mjs',
      {
        'scripts/unwatched-code-baseline.json': JSON.stringify({
          'deploy/threads-relay/worker.js': 'когда-то было нечем тестировать',
        }),
        'deploy/threads-relay/worker.js': UNWATCHED,
        'test/e2e-support/relay.spec.ts':
          "it('x', () => 'worker.js');\n",
      },
      { git: true },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('протухшие записи');
    expect(res.stderr).toContain('deploy/threads-relay/worker.js');
  });

  it('запись бейслайна протухла (файла больше нет) — exit 1', () => {
    const res = runGate(
      'check-unwatched-code.mjs',
      {
        'scripts/unwatched-code-baseline.json': JSON.stringify({
          'deploy/ghost.sh': 'старый скрипт, давно удалён из дерева',
        }),
        'deploy/threads-relay/worker.js':
          "const secret = 'x';\nexports.check = secret;\n",
        'test/e2e-support/relay.spec.ts':
          "it('x', () => 'worker.js');\n",
      },
      { git: true },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('протухшие записи');
    expect(res.stderr).toContain('deploy/ghost.sh');
  });

  it('код внутри watched-деревьев (src/, public/) гейт не трогает — не его забота', () => {
    const res = runGate(
      'check-unwatched-code.mjs',
      {
        // Здесь нет ни одного тестового файла, поэтому копия самого гейта
        // (см. SELF_BASELINE выше) не упомянута ничем — баселиним её явно,
        // иначе сценарий ломается из-за механизма песочницы, а не проверки.
        'scripts/unwatched-code-baseline.json': JSON.stringify(SELF_BASELINE),
        'webapp/public/loader.js': "if (1) {}\n",
        'src/some.service.js': "module.exports = {};\n",
      },
      { git: true },
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('все под тестом');
  });

  it('--update записывает найденное (кроме уже покрытых тестом) в бейслайн', () => {
    const res = runGate(
      'check-unwatched-code.mjs',
      {
        'scripts/unwatched-code-baseline.json': '{}',
        'deploy/threads-relay/worker.js': UNWATCHED,
      },
      { args: ['--update'], git: true },
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('Бейслайн обновлён');
    expect(res.stdout).toContain('deploy/threads-relay/worker.js');
  });
});
