// Сверка: КАЖДОЕ зашифрованное поле обязано быть в scripts/rotate-encryption-key.ts
// (аудит 2026-07-20, H4).
//
// Инцидент, который это предотвращает: рунбук ротации ENCRYPTION_KEY
// (docs/SECURITY.md) добавляет второй ключ, гоняет rotate-encryption-key,
// затем УДАЛЯЕТ старый ключ. Любое зашифрованное поле, пропущенное скриптом,
// остаётся под старым ключом → в шаге «удалить старый ключ» превращается в
// нерасшифровываемый мусор БЕЗ ошибки (decrypt() молча возвращает ciphertext
// как «plaintext»). На момент аудита скрипт не покрывал Booking, Donation,
// Subscription, ModeMap, TherapistCustomMode, TherapistRequest, TherapyRelation,
// totp-секреты и часть полей (evidenceFor/evidenceAgainst, emotions,
// modeMapNodes/Edges, history) — то есть платёжки, чеки ФНС и 2FA.
//
// Механизм: статически находим зашифрованные поля в src/ (декларативный
// EncryptSchema + инлайн `field: encrypt(...)`) и требуем, чтобы имя каждого
// встречалось в скрипте ротации. Проверка на уровне ИМЕНИ поля (не модель+поле):
// residual-слабость — новое поле с именем, уже покрытым для другой модели,
// проскользнёт; но реальные пропуски (отдельные имена) ловятся. Стиль —
// как у table-registry.spec.ts (чтение исходников как текста, без импорта).
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const rotationScript = readFileSync(
  join(ROOT, 'scripts', 'rotate-encryption-key.ts'),
  'utf8',
);

// ── Рекурсивный обход src/ (без спеков/тестов) ──────────────────────────────
function collectTs(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      collectTs(p, out);
    } else if (
      p.endsWith('.ts') &&
      !p.endsWith('.spec.ts') &&
      !p.endsWith('.test.ts') &&
      !p.endsWith('.d.ts')
    ) {
      out.push(p);
    }
  }
  return out;
}

const srcFiles = collectTs(join(ROOT, 'src'));

// ── Обнаружение зашифрованных полей ─────────────────────────────────────────
// (1) EncryptSchema = { strings:[...], jsonArrays:[...] } → все строки в блоке.
// (2) инлайн `field: encrypt(` / `field: encryptJson(` (объектное свойство).
function discoverEncryptedFields(): Map<string, string> {
  const found = new Map<string, string>(); // field → пример файла
  const rel = (f: string) => f.slice(ROOT.length + 1);
  for (const file of srcFiles) {
    const text = readFileSync(file, 'utf8');

    // (1) EncryptSchema-литералы
    const schemaRe = /EncryptSchema\s*=\s*\{([\s\S]*?)\}/g;
    let sm: RegExpExecArray | null;
    while ((sm = schemaRe.exec(text)) !== null) {
      // отбрасываем строки-комментарии (пример в crypto.ts)
      if (/^\s*\/\//.test(text.slice(sm.index - 3, sm.index))) continue;
      const fieldRe = /'([a-zA-Z][\w]*)'/g;
      let fm: RegExpExecArray | null;
      while ((fm = fieldRe.exec(sm[1])) !== null) {
        if (!found.has(fm[1])) found.set(fm[1], rel(file));
      }
    }

    // (2) инлайн encrypt/encryptJson как значение свойства объекта.
    // Требуем `{` или `,` перед именем — иначе ловится тернар
    // `cond ? val : encrypt(val)` (val — не колонка).
    const inlineRe = /[{,]\s*(\w+)\s*:\s*(?:encrypt|encryptJson)\(/g;
    let im: RegExpExecArray | null;
    while ((im = inlineRe.exec(text)) !== null) {
      if (!found.has(im[1])) found.set(im[1], rel(file));
    }
  }
  return found;
}

// Поля, зашифрованные ПРИСВАИВАНИЕМ (`const data = encryptJson(...)`), а не
// свойством объекта или EncryptSchema — авто-обнаружение их не видит (LHS-имя
// переменной ненадёжно: у большинства это generic `enc`/`encText`, дало бы
// false-positive). Такие поля перечисляются здесь ВРУЧНУЮ и всё равно
// проверяются против скрипта ротации. Реальный инцидент: DiaryDraft.data
// (клинический текст черновика) шифровался, но в ротацию не попал, и обе
// авто-защиты (эта сверка + ручной обзор) его пропустили — 2026-07-20, H3.
const ASSIGNMENT_ENCRYPTED: Record<string, string> = {
  data: 'src/api/api.controller.ts (DiaryDraft.data)',
};

describe('покрытие ротации ENCRYPTION_KEY (H4)', () => {
  const encrypted = discoverEncryptedFields();
  for (const [field, where] of Object.entries(ASSIGNMENT_ENCRYPTED)) {
    if (!encrypted.has(field)) encrypted.set(field, where);
  }

  it('обнаружены зашифрованные поля (санити — парсер не сломан)', () => {
    // Если обнаружений мало — регэксп протух и тест стал бесполезен.
    expect(encrypted.size).toBeGreaterThan(20);
  });

  it('каждое зашифрованное поле присутствует в скрипте ротации', () => {
    const missing: string[] = [];
    for (const [field, file] of encrypted) {
      // поле покрыто, если его имя встречается как строка в скрипте ротации
      if (!rotationScript.includes(`'${field}'`)) {
        missing.push(`${field}  (напр. ${file})`);
      }
    }
    expect({ missing }).toEqual({ missing: [] });
  });

  it('вложенный history ротируется отдельным блоком', () => {
    // history — массив снапшотов, общий строковый цикл его не трогает.
    expect(rotationScript).toMatch(/clientConceptualization\.history/);
    expect(rotationScript).toContain('.history');
  });
});
