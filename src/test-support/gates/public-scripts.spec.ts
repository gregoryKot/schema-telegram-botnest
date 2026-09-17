// Тест гейта check-public-scripts.mjs (инцидент 2026-08-08: загрузчик моста
// MAX в `webapp/public/` сломал вход всем пользователям Telegram и не был
// виден ни одному инструменту — его никто не импортирует, значит его нет ни в
// coverage, ни в гейте мёртвых файлов, ни в одном тесте).
//
// Проверяем ОБА исхода: гейт краснеет на непокрытом браузерном коде и зеленеет
// на чистом дереве. Второй не менее важен: ложно-красный гейт отключают.
import { runGate } from './gate-sandbox';

const LOADER = "if (location.hash.indexOf('X=') > -1) load();\n";

describe('check-public-scripts.mjs', () => {
  it('скрипт в public/ без единого теста — exit 1, путь в stderr', () => {
    const res = runGate('check-public-scripts.mjs', {
      'scripts/public-scripts-baseline.json': '{}',
      'webapp/public/loader.js': LOADER,
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('браузерный код без теста');
    expect(res.stderr).toContain('webapp/public/loader.js');
  });

  it('скрипт упомянут ТОЛЬКО в `//` комментарии — не считается, exit 1', () => {
    const res = runGate('check-public-scripts.mjs', {
      'scripts/public-scripts-baseline.json': '{}',
      'webapp/public/loader.js': LOADER,
      'webapp/src/loader.test.ts':
        '// TODO: написать тест на loader.js, пока руки не дошли\n' +
        "it('заглушка', () => 1);\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/public/loader.js');
  });

  it('скрипт упомянут ТОЛЬКО в /* */ блочном комментарии — тоже не считается, exit 1', () => {
    const res = runGate('check-public-scripts.mjs', {
      'scripts/public-scripts-baseline.json': '{}',
      'webapp/public/loader.js': LOADER,
      'webapp/src/loader.test.ts':
        '/* см. public/loader.js — здесь пока пусто */\n' +
        "it('заглушка', () => 1);\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/public/loader.js');
  });

  // Регрессионный тест на сам сканер: наивное построчное вырезание `//...$`
  // без учёта строк превратило бы `'https://…'` в комментарий и съело бы
  // остаток строки — включая реальное упоминание файла на той же строке.
  it('URL со `//` внутри строки не ломает поиск реального упоминания на той же строке', () => {
    const res = runGate('check-public-scripts.mjs', {
      'scripts/public-scripts-baseline.json': '{}',
      'webapp/public/loader.js': LOADER,
      'webapp/src/loader.test.ts':
        "const cdn = 'https://cdn.example.com/lib.js'; " +
        "const SRC = read('../public/loader.js');\n" +
        "it('грузится', () => SRC);\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('все под тестом');
  });

  it('на скрипт есть тест — гейт зелёный', () => {
    const res = runGate('check-public-scripts.mjs', {
      'scripts/public-scripts-baseline.json': '{}',
      'webapp/public/loader.js': LOADER,
      'webapp/src/loader.test.ts':
        "const SRC = read('../public/loader.js');\nit('грузится только по своему параметру', () => SRC);\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('все под тестом');
  });

  it('вендорный скрипт с причиной в бейслайне — гейт зелёный', () => {
    const res = runGate('check-public-scripts.mjs', {
      'scripts/public-scripts-baseline.json': JSON.stringify({
        'webapp/public/vendor-sdk.js': 'чужой SDK, тестируем не его',
      }),
      'webapp/public/vendor-sdk.js': 'window.Vendor = {};\n',
    });
    expect(res.status).toBe(0);
  });

  it('запись бейслайна протухла (тест появился) — exit 1', () => {
    const res = runGate('check-public-scripts.mjs', {
      'scripts/public-scripts-baseline.json': JSON.stringify({
        'webapp/public/loader.js': 'когда-то было нечем тестировать',
      }),
      'webapp/public/loader.js': LOADER,
      'webapp/src/loader.test.ts': "it('x', () => 'loader.js');\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('протухшие записи');
  });

  // Инлайн-скрипт нельзя ни импортировать, ни покрыть тестом — поэтому он
  // фиксируется по хешу содержимого: правка обязана быть осознанной.
  it('новый инлайн-скрипт в index.html — exit 1', () => {
    const res = runGate('check-public-scripts.mjs', {
      'scripts/public-scripts-baseline.json': '{}',
      'webapp/index.html':
        '<html><head><script>document.title = "x";</script></head></html>',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('инлайн-скрипт');
  });

  it('правка замороженного инлайн-скрипта роняет гейт (хеш меняется)', () => {
    const frozen = runGate('check-public-scripts.mjs', {
      'scripts/public-scripts-baseline.json': '{}',
      'webapp/index.html':
        '<html><head><script>theme();</script></head></html>',
    });
    const key = frozen.stderr.match(/webapp\/index\.html#inline-[0-9a-f]+/)![0];

    // С этой записью дерево чистое…
    expect(
      runGate('check-public-scripts.mjs', {
        'scripts/public-scripts-baseline.json': JSON.stringify({
          [key]: 'тема до первой отрисовки, заморожено',
        }),
        'webapp/index.html':
          '<html><head><script>theme();</script></head></html>',
      }).status,
    ).toBe(0);

    // …а стоит поменять код внутри — хеш другой, гейт краснеет.
    const edited = runGate('check-public-scripts.mjs', {
      'scripts/public-scripts-baseline.json': JSON.stringify({
        [key]: 'тема до первой отрисовки, заморожено',
      }),
      'webapp/index.html':
        '<html><head><script>theme(); track();</script></head></html>',
    });
    expect(edited.status).toBe(1);
  });

  it('ld+json и внешние script не считаются кодом без теста', () => {
    const res = runGate('check-public-scripts.mjs', {
      'scripts/public-scripts-baseline.json': '{}',
      'webapp/index.html':
        '<html><head><script type="application/ld+json">{"@type":"Person"}</script>' +
        '<script src="/telegram-web-app.js"></script></head></html>',
    });
    expect(res.status).toBe(0);
  });

  it('--update записывает найденное в бейслайн', () => {
    const res = runGate(
      'check-public-scripts.mjs',
      {
        'scripts/public-scripts-baseline.json': '{}',
        'webapp/public/loader.js': LOADER,
      },
      { args: ['--update'] },
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('Бейслайн обновлён');
  });
});
