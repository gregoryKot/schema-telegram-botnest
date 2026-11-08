import { ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { encrypt, tryDecrypt } from '../utils/crypto';
import { buildVcalendar } from '../booking/caldav-event.util';

// Файл .ics шага плана по https-ссылке (аудит 2026-11, E6). В Telegram файл,
// собранный на устройстве data:-URL, не открыть: `openLink` клиента пускает
// только http(s) и бросает WebAppTgUrlInvalid. Ссылку открывает внешний
// браузер без нашей сессии, поэтому всё, что нужно для файла, едет в самой
// ссылке — запечатанным AES-GCM (ключ ENCRYPTION_KEY, `utils/crypto.ts`):
// текст практики не лежит в адресе и в логах прокси открытым, а подделать
// содержимое без ключа нельзя. Ссылка живёт сутки — её открывают сразу.
// Ключ общий с клиническими полями, поэтому токен несёт метку назначения
// (PURPOSE) внутри шифротекста: анонимный GET не открывает шифротекст поля
// из БД, даже если в нём JSON нужной формы.

export interface PracticeIcsEvent {
  text: string;
  needLabel: string;
  /** Начало события, мс UTC (planEventStartMs на клиенте). */
  startMs: number;
}

const TTL_MS = 24 * 3_600_000;
const DURATION_MIN = 30; // как у файла с устройства (shared/src/utils/ics.ts)
const TOKEN_RE = /^[A-Za-z0-9_-]{40,2048}$/;
const PURPOSE = 'plan-ics:v1:';

interface Sealed {
  t: string;
  n: string;
  s: number;
  e: number;
}

/** Запечатать событие в токен для адреса (base64url). */
export function sealPracticeIcs(
  ev: PracticeIcsEvent,
  now = Date.now(),
): string {
  const json = JSON.stringify({
    t: ev.text,
    n: ev.needLabel,
    s: ev.startMs,
    e: now + TTL_MS,
  } satisfies Sealed);
  const sealed = encrypt(PURPOSE + json);
  // Без ключа (локальная разработка) encrypt отдаёт текст как есть — открытый
  // текст в адрес не кладём.
  if (!sealed || sealed === PURPOSE + json)
    throw new ServiceUnavailableException('Шифрование не настроено');
  return Buffer.from(sealed, 'base64').toString('base64url');
}

/** Открыть токен; чужой, битый или просроченный — null. */
export function openPracticeIcs(
  token: string,
  now = Date.now(),
): PracticeIcsEvent | null {
  if (!TOKEN_RE.test(token)) return null;
  const r = tryDecrypt(Buffer.from(token, 'base64url').toString('base64'));
  if (!r.ok || !r.text.startsWith(PURPOSE)) return null;
  try {
    const p = JSON.parse(r.text.slice(PURPOSE.length)) as Partial<Sealed>;
    if (typeof p.t !== 'string' || typeof p.n !== 'string') return null;
    if (typeof p.s !== 'number' || typeof p.e !== 'number' || now > p.e)
      return null;
    return { text: p.t, needLabel: p.n, startMs: p.s };
  } catch {
    return null;
  }
}

/** Тело файла: то же событие, что собирает устройство, с сигналом в начале. */
export function practiceIcsText(ev: PracticeIcsEvent): string {
  return buildVcalendar(
    [
      {
        uid: `practice-${randomUUID()}@schemehappens.ru`,
        startsAt: new Date(ev.startMs),
        durationMin: DURATION_MIN,
        summary: ev.text,
        description: `Практика для потребности: ${ev.needLabel}`,
        alarmMinutesBefore: 0,
      },
    ],
    'Всё по схеме',
  );
}
