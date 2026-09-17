// Тест гейта check-token-contract.mjs — контракт дизайн-токенов webapp ⇄
// schema-miniapp (дизайн-аудит 2026-08, В11). Список имён "только имя"
// зашит в самом скрипте (SHARED_NAME_ONLY_TOKENS), поэтому позитивный кейс
// дублирует его здесь — тот же приём, что PAIRS в check-paired-files.mjs:
// если список в скрипте изменится, список ниже придётся обновить вместе.
import { runGate } from './gate-sandbox';
import { loadStringList } from './pattern-loader';

// Копия SHARED_NAME_ONLY_TOKENS из scripts/check-token-contract.mjs.
const SHARED_NAME_ONLY_TOKENS = [
  '--accent-red',
  '--accent-orange',
  '--accent-yellow',
  '--accent-green',
  '--accent-blue',
  '--accent-pink',
  '--bg',
  '--surface',
  '--surface-2',
  '--text',
  '--text-sub',
  '--text-faint',
  '--line',
  '--border-color',
  '--nav-bg',
  '--sheet-bg',
  '--sheet-bg-2',
  '--track-color',
  '--fg-rgb',
];

const VALID_TOKENS_CSS = `:root, [data-theme='light'] {\n  --accent: #9a5b3e;\n}\n[data-theme='dark'] {\n  --accent: #c97d5a;\n}\n`;

/** Валидный index.css: импортирует контракт + объявляет все name-only токены. */
function validAppCss(): string {
  const nameOnly = SHARED_NAME_ONLY_TOKENS.map((n) => `  ${n}: #000;`).join(
    '\n',
  );
  return `@import '../../shared/src/theme/tokens.css';\n:root {\n${nameOnly}\n}\n`;
}

describe('check-token-contract.mjs', () => {
  it('нет shared/src/theme/tokens.css — exit 1, понятная ошибка', () => {
    const res = runGate('check-token-contract.mjs', {
      'webapp/src/index.css': validAppCss(),
      'schema-miniapp/src/index.css': validAppCss(),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('Не найден контракт токенов');
  });

  it('index.css не импортирует tokens.css — exit 1, называет файл', () => {
    const nameOnly = SHARED_NAME_ONLY_TOKENS.map((n) => `  ${n}: #000;`).join(
      '\n',
    );
    const res = runGate('check-token-contract.mjs', {
      'shared/src/theme/tokens.css': VALID_TOKENS_CSS,
      'webapp/src/index.css': `:root {\n${nameOnly}\n}\n`, // без @import
      'schema-miniapp/src/index.css': validAppCss(),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/src/index.css: не импортирует');
  });

  it('name-only токен объявлен только в одном index.css — exit 1, называет токен', () => {
    const withoutAccentRed = SHARED_NAME_ONLY_TOKENS.filter(
      (n) => n !== '--accent-red',
    )
      .map((n) => `  ${n}: #000;`)
      .join('\n');
    const res = runGate('check-token-contract.mjs', {
      'shared/src/theme/tokens.css': VALID_TOKENS_CSS,
      'webapp/src/index.css': `@import '../../shared/src/theme/tokens.css';\n:root {\n${withoutAccentRed}\n}\n`,
      'schema-miniapp/src/index.css': validAppCss(),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      '--accent-red: не объявлен в webapp/src/index.css',
    );
  });

  it('токен упомянут только через var(), но не объявлен — всё равно считается отсутствующим', () => {
    const res = runGate('check-token-contract.mjs', {
      'shared/src/theme/tokens.css': VALID_TOKENS_CSS,
      'webapp/src/index.css':
        `@import '../../shared/src/theme/tokens.css';\n` +
        `.chip { color: var(--accent-red); }\n`, // ссылка, не объявление
      'schema-miniapp/src/index.css': validAppCss(),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      '--accent-red: не объявлен в webapp/src/index.css',
    );
  });

  it('оба index.css соблюдают контракт — exit 0', () => {
    const res = runGate('check-token-contract.mjs', {
      'shared/src/theme/tokens.css': VALID_TOKENS_CSS,
      'webapp/src/index.css': validAppCss(),
      'schema-miniapp/src/index.css': validAppCss(),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ Контракт токенов соблюдён');
  });
});

// ── Фолбэк в var() ────────────────────────────────────────────────────────
// Класс, ради которого проверка добавлена: `var(--danger, #e5484d)` — токена
// --danger не было объявлено нигде, поэтому рисовался фолбэк, и фолбэки
// разъехались между площадками. Гейт обязан краснеть на любой фолбэк и
// молчать ровно на тех, где значение задаёт инстанс элемента или площадка.
describe('check-token-contract.mjs — фолбэк в var()', () => {
  /** Валидное дерево + один файл-нарушитель (или разрешённый образец). */
  function runWith(relPath: string, source: string) {
    return runGate('check-token-contract.mjs', {
      'shared/src/theme/tokens.css': VALID_TOKENS_CSS,
      'webapp/src/index.css': validAppCss(),
      'schema-miniapp/src/index.css': validAppCss(),
      [relPath]: source,
    });
  }

  it('фолбэк в .tsx — exit 1, называет файл, строку и токен', () => {
    const res = runWith(
      'schema-miniapp/src/components/JoinConfirmSheet.tsx',
      `export const s = { color: 'var(--danger, #c0392b)' };\n`,
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      'schema-miniapp/src/components/JoinConfirmSheet.tsx:1: фолбэк в var(--danger, …)',
    );
  });

  it('фолбэк в .css второго фронтенда тоже виден', () => {
    const res = runWith(
      'webapp/src/pages/landing.css',
      `.x { color: var(--c-rose, #c46b6b); }\n`,
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('var(--c-rose, …)');
  });

  it('чистое дерево без фолбэков — exit 0', () => {
    const res = runWith(
      'webapp/src/components/AddressFormPicker.tsx',
      `export const s = { color: 'var(--accent-red)' };\n`,
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('фолбэков в var() нет');
  });

  it('фолбэк в комментарии не считается, тот же текст в коде — считается', () => {
    const inComment = runWith(
      'shared/src/theme/extra.css',
      `/* было var(--danger, #e5484d) — см. историю */\n.x { color: var(--accent-red); }\n`,
    );
    expect(inComment.status).toBe(0);

    const inCode = runWith(
      'shared/src/theme/extra.css',
      `.x { color: var(--danger, #e5484d); }\n`,
    );
    expect(inCode.status).toBe(1);
  });

  it('`//` в URL не принимается за комментарий — фолбэк после ссылки виден', () => {
    const res = runWith(
      'webapp/src/x.ts',
      `export const s = 'https://example.com' + 'var(--danger, #e5484d)';\n`,
    );
    expect(res.status).toBe(1);
  });

  // Контрольная пара к HOST_PREFIXES: свойство площадки гасится, наше
  // собственное --safe-bottom с точно таким же фолбэком `0px` — нет.
  // Без второй половины проверка ничего не доказывает (правило №15).
  it('--tg-* (свойство мессенджера) разрешено, наш --safe-bottom — нет', () => {
    const host = runWith(
      'schema-miniapp/src/index2.css',
      `:root { --safe-bottom: var(--tg-safe-area-inset-bottom, 0px); }\n`,
    );
    expect(host.status).toBe(0);

    const ours = runWith(
      'schema-miniapp/src/components/UpdateToast.tsx',
      `export const s = { bottom: 'calc(76px + var(--safe-bottom, 0px))' };\n`,
    );
    expect(ours.status).toBe(1);
    expect(ours.stderr).toContain('var(--safe-bottom, …)');
  });

  // Метагейт check-gate-exemptions.mjs требует теста на имя списка; правило
  // №15 — образец, который запись гасит, И контрольный, который не должна.
  describe('FALLBACK_ALLOW', () => {
    const allow = loadStringList('check-token-contract.mjs', 'FALLBACK_ALLOW');

    it('список непустой и состоит из имён кастомных свойств', () => {
      expect(allow.length).toBeGreaterThan(0);
      for (const name of allow) expect(name).toMatch(/^--[a-z][a-z0-9-]*$/);
    });

    it.each(allow)(
      '%s гасится, а соседний токен на его месте — нет',
      (name) => {
        const allowed = runWith(
          'webapp/src/allowed.css',
          `.x { color: var(${name}, var(--accent)); }\n`,
        );
        expect(allowed.status).toBe(0);

        const control = runWith(
          'webapp/src/allowed.css',
          `.x { color: var(${name}-not-allowed, var(--accent)); }\n`,
        );
        expect(control.status).toBe(1);
        expect(control.stderr).toContain(`var(${name}-not-allowed, …)`);
      },
    );
  });
});
