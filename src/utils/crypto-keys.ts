import { createHmac } from 'crypto';

// Разбор ключей шифрования из env — вынесен из crypto.ts (правило №10: модуль
// упирался в потолок размера, а рядом понадобился keyedDigests).
//   ENCRYPTION_KEY     — текущий ключ, им шифруется ВСЁ новое
//   ENCRYPTION_KEY_OLD — старые ключи через запятую, только для расшифровки
const HEX_KEY_RE = /^[0-9a-f]{64}$/i;
type Keys = { current: Buffer | null; all: Buffer[]; badOld: number };

function loadKeys(): Keys {
  // Аудит 2026-10 (D3): одной проверки длины мало — `Buffer.from('zz…', 'hex')`
  // обрывает разбор на первом не-hex символе и отдаёт КОРОТКИЙ буфер, а длина
  // строки при этом ровно 64. Ключ «проходил» проверку и падал только на первой
  // записи. Поэтому формат проверяется целиком: ровно 64 hex-символа.
  const parse = (hex: string): Buffer | null =>
    HEX_KEY_RE.test(hex) ? Buffer.from(hex, 'hex') : null;
  // Stryker disable next-line StringLiteral: эквивалентный мутант — строка вместо '' не 64 hex и отбрасывается тем же HEX_KEY_RE
  const cur = parse((process.env.ENCRYPTION_KEY ?? '').trim());
  // Пустой элемент списка («a,,b», хвостовая запятая) — не ключ и не ошибка.
  const olds = (process.env.ENCRYPTION_KEY_OLD ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parse);
  return {
    current: cur,
    all: [cur, ...olds].filter((k): k is Buffer => k !== null),
    // Битые старые ключи: ими crypto.ts роняет бут в проде (разбор env — только здесь).
    badOld: olds.filter((k) => k === null).length,
  };
}

/** Ключи процесса: разбираются один раз при загрузке модуля. */
export const KEYS = loadKeys();

/**
 * HMAC-SHA256 от `data` под подключом каждого ключа шифрования: подключ —
 * HMAC ключа с доменной меткой `label`, так один ENCRYPTION_KEY не служит двум
 * ролям напрямую. `current` — под текущим ключом (null без ключа), `all` — под
 * текущим и каждым из ENCRYPTION_KEY_OLD (окно ротации), текущий первым.
 */
export function keyedDigests(
  label: string,
  data: string,
): { current: string | null; all: string[] } {
  const digest = (key: Buffer): string => {
    const sub = createHmac('sha256', key).update(label).digest();
    return createHmac('sha256', sub).update(data).digest('hex');
  };
  return {
    current: KEYS.current ? digest(KEYS.current) : null,
    all: KEYS.all.map(digest),
  };
}
