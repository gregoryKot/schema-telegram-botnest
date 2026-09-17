// Тест гейта check-token-contract.mjs — контракт дизайн-токенов webapp ⇄
// schema-miniapp (дизайн-аудит 2026-08, В11). Список имён "только имя"
// зашит в самом скрипте (SHARED_NAME_ONLY_TOKENS), поэтому позитивный кейс
// дублирует его здесь — тот же приём, что PAIRS в check-paired-files.mjs:
// если список в скрипте изменится, список ниже придётся обновить вместе.
import { runGate } from './gate-sandbox';

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
