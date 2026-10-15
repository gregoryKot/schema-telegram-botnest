// Инвариант класса «подпись initData Telegram проверяет одна реализация»
// (аудит 2026-10). Гейтом на литерал `3600` не обойтись: он законно стоит в
// sitemap.middleware.ts (max-age), probe-backup-freshness.ts и в окне MAX
// (max-init-data.ts). Поэтому проверяется причина, а не симптом:
//   (а) схема подписи `HMAC(key="WebAppData", токен)` пересчитывается только
//       в telegram-init-data.ts и в верификаторе MAX;
//   (б) @tma.js/init-data-node не используется в рабочем коде (его validate
//       сравнивал подпись через === и проверял срок раньше подписи);
//   (в) окно в telegram-init-data.ts — только INIT_DATA_MAX_AGE_S.
// Образец — telegram.invariants.spec.ts (grep по исходникам без исполнения).
import { readFileSync } from 'fs';
import { join, relative } from 'path';
import { collectSourceFiles } from '../security/collect-source-files';

const SRC = join(__dirname, '..');

/**
 * Исключения из (а). Правило №15 п.2: у каждого — причина и контрольный
 * образец ниже (файл вне списка с тем же кодом краснеет).
 */
const HMAC_WEBAPPDATA_ALLOWED: Record<string, string> = {
  'auth/telegram-init-data.ts': 'единственный верификатор Telegram',
  'auth/max-init-data.ts':
    'MAX — другая площадка: свой токен бота и своё окно (DEFAULT_EXPIRES_IN_S); ' +
    'ту же схему подписи MAX позаимствовал у Telegram',
};

const HMAC_WEBAPPDATA =
  /createHmac\(\s*['"`]sha256['"`]\s*,\s*['"`]WebAppData['"`]/;
const TMA_VALIDATE =
  /from\s+['"]@tma\.js\/init-data-node['"]|require\(\s*['"]@tma\.js\/init-data-node['"]\s*\)/;

const files = collectSourceFiles(SRC, {
  filter: (f) => !f.includes('.spec-helper.'),
}).map((f) => ({
  rel: relative(SRC, f).split('\\').join('/'),
  text: readFileSync(f, 'utf8'),
}));

/** Файлы, пересчитывающие подпись WebAppData, которым это не разрешено. */
function strayHmacVerifiers(
  sources: { rel: string; text: string }[],
): string[] {
  return sources
    .filter((s) => HMAC_WEBAPPDATA.test(s.text))
    .map((s) => s.rel)
    .filter((rel) => !(rel in HMAC_WEBAPPDATA_ALLOWED));
}

describe('верификатор initData Telegram — одна реализация', () => {
  it('(а) схема HMAC "WebAppData" живёт только в разрешённых файлах', () => {
    expect(strayHmacVerifiers(files)).toEqual([]);
  });

  it('(а) список исключений не протух: оба файла действительно содержат схему', () => {
    for (const rel of Object.keys(HMAC_WEBAPPDATA_ALLOWED)) {
      const hit = files.find((f) => f.rel === rel);
      expect(hit?.text).toMatch(HMAC_WEBAPPDATA);
    }
  });

  it('(а) контроль: тот же код в постороннем файле краснеет', () => {
    const forged = {
      rel: 'auth/auth.service.ts',
      text: "createHmac('sha256', 'WebAppData').update(token).digest()",
    };
    const doubleQuoted = {
      rel: 'api/other.ts',
      text: 'createHmac(\n "sha256",\n "WebAppData")',
    };
    expect(strayHmacVerifiers([forged, doubleQuoted])).toEqual([
      'auth/auth.service.ts',
      'api/other.ts',
    ]);
    // и контрольный образец с другим ключом (Login Widget и пр.) — не наш класс
    expect(
      strayHmacVerifiers([
        { rel: 'x.ts', text: "createHmac('sha256', 'другой')" },
      ]),
    ).toEqual([]);
  });

  it('(б) @tma.js/init-data-node не импортируется в рабочем коде', () => {
    expect(
      files.filter((f) => TMA_VALIDATE.test(f.text)).map((f) => f.rel),
    ).toEqual([]);
    expect(
      TMA_VALIDATE.test("import { validate } from '@tma.js/init-data-node';"),
    ).toBe(true);
    expect(
      TMA_VALIDATE.test("const m = require('@tma.js/init-data-node')"),
    ).toBe(true);
  });

  it('(в) окно в telegram-init-data.ts берётся из INIT_DATA_MAX_AGE_S, своих литералов нет', () => {
    const own = files.find((f) => f.rel === 'auth/telegram-init-data.ts');
    expect(own).toBeDefined();
    const code = (own?.text ?? '')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');
    expect(code).toMatch(
      /import\s*\{\s*INIT_DATA_MAX_AGE_S\s*\}\s*from\s*'\.\.\/api\/init-data-window'/,
    );
    expect(code).toMatch(/>\s*INIT_DATA_MAX_AGE_S/);
    expect(code).not.toMatch(/\b(3600|86400|1000\s*\*\s*60)\b/);
  });
});
