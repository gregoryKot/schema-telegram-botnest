import { Probe } from './types';
import { backupConfigState, missingBackupVars } from '../backup-config';

// Проба «бэкапы в B2 действительно делаются» (аудит D-2, правило №21).
// Скрипт бэкапа молчал годами, потому что его никто не вызывал и никто не
// спрашивал результат. Проба смотрит не на конфигурацию, а на итог: самый
// свежий файл schemehappens-*.sql.gz.enc в бакете (родной API B2 — тот же,
// которым бэкап туда пишет). Старше 36 ч — суточный прогон пропущен хотя бы
// раз и не наверстан (планировщик повторяет сбойный прогон каждый час).

const B2_AUTH_URL = 'https://api.backblazeb2.com/b2api/v3/b2_authorize_account';
const TIMEOUT_MS = 10_000;
const MAX_AGE_HOURS = 36;
const MAX_PAGES = 5;
/** Первый бэкап после включения делается через минуту после старта и идёт минуты — не тревожим. */
const FIRST_BACKUP_GRACE_SEC = 3600;
const NAME_RE = /^schemehappens-(\d{4}-\d{2}-\d{2})\.sql\.gz\.enc$/;

type Env = Record<string, string | undefined>;
type FetchFn = typeof fetch;

export interface BackupProbeDeps {
  fetchFn?: FetchFn;
  now?: () => number;
  uptimeSec?: () => number;
}

interface B2Auth {
  token: string;
  apiUrl: string;
  accountId: string;
  bucketId?: string;
}
interface B2File {
  fileName: string;
  uploadTimestamp?: number;
}
interface B2AuthBody {
  authorizationToken?: string;
  accountId?: string;
  apiInfo?: { storageApi?: { apiUrl?: string; bucketId?: string } };
  allowed?: { bucketId?: string };
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const why = typeof body.message === 'string' ? `: ${body.message}` : '';
    throw new Error(`B2 ответил HTTP ${res.status}${why.slice(0, 120)}`);
  }
  return body;
}

async function authorize(env: Env, fetchFn: FetchFn): Promise<B2Auth> {
  const basic = Buffer.from(`${env.B2_KEY_ID}:${env.B2_APP_KEY}`).toString(
    'base64',
  );
  const res = await fetchFn(B2_AUTH_URL, {
    headers: { Authorization: `Basic ${basic}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = (await readJson(res)) as B2AuthBody;
  const apiUrl = body.apiInfo?.storageApi?.apiUrl;
  if (!body.authorizationToken || !apiUrl || !body.accountId) {
    throw new Error('в ответе авторизации B2 нет токена или адреса API');
  }
  return {
    token: body.authorizationToken,
    apiUrl,
    accountId: body.accountId,
    bucketId: body.apiInfo?.storageApi?.bucketId ?? body.allowed?.bucketId,
  };
}

async function b2Post(
  auth: B2Auth,
  fetchFn: FetchFn,
  method: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetchFn(`${auth.apiUrl}/b2api/v3/${method}`, {
    method: 'POST',
    headers: {
      Authorization: auth.token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return readJson(res);
}

async function findBucketId(
  auth: B2Auth,
  fetchFn: FetchFn,
  bucketName: string,
): Promise<string> {
  if (auth.bucketId) return auth.bucketId;
  const body = await b2Post(auth, fetchFn, 'b2_list_buckets', {
    accountId: auth.accountId,
    bucketName,
  });
  const buckets = (body.buckets ?? []) as Array<{ bucketId?: string }>;
  const id = buckets[0]?.bucketId;
  if (!id) throw new Error(`бакет ${bucketName} не найден`);
  return id;
}

async function listBackups(
  auth: B2Auth,
  fetchFn: FetchFn,
  bucketId: string,
): Promise<B2File[]> {
  const found: B2File[] = [];
  let startFileName: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const body = await b2Post(auth, fetchFn, 'b2_list_file_names', {
      bucketId,
      prefix: 'schemehappens-',
      maxFileCount: 1000,
      ...(startFileName ? { startFileName } : {}),
    });
    const files = (body.files ?? []) as B2File[];
    found.push(...files.filter((f) => NAME_RE.test(f.fileName)));
    startFileName = (body.nextFileName as string | null) ?? null;
    if (!startFileName) break;
  }
  return found;
}

const ddmm = (ms: number): string => {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}`;
};

/** Время файла: момент загрузки; нет его в ответе — полночь UTC даты из имени. */
const fileTime = (f: B2File): number => {
  if (typeof f.uploadTimestamp === 'number') return f.uploadTimestamp;
  const date = NAME_RE.exec(f.fileName)?.[1] ?? '1970-01-01';
  return Date.parse(`${date}T00:00:00Z`);
};

export function backupFreshnessProbe(
  env: Env = process.env,
  deps: BackupProbeDeps = {},
): Probe {
  const fetchFn = deps.fetchFn ?? fetch;
  const now = deps.now ?? Date.now;
  const uptimeSec = deps.uptimeSec ?? (() => process.uptime());
  return {
    id: 'backupFreshness',
    title: 'Бэкапы БД в Backblaze B2',
    critical: false,
    async run() {
      const state = backupConfigState(env);
      if (state === 'off') return { ok: true, detail: 'выключено' };
      if (state === 'partial') {
        return {
          ok: false,
          detail: `бэкапы настроены не до конца: не заданы ${missingBackupVars(env).join(', ')}`,
        };
      }
      try {
        const auth = await authorize(env, fetchFn);
        const bucketId = await findBucketId(
          auth,
          fetchFn,
          env.B2_BUCKET as string,
        );
        const files = await listBackups(auth, fetchFn, bucketId);
        if (files.length === 0) {
          return uptimeSec() < FIRST_BACKUP_GRACE_SEC
            ? {
                ok: true,
                detail: 'ждём первый бэкап (сервис только что запущен)',
              }
            : { ok: false, detail: 'бэкапов в бакете нет' };
        }
        const newest = Math.max(...files.map(fileTime));
        const ageH = Math.floor((now() - newest) / 3_600_000);
        const detail = `последний бэкап ${ddmm(newest)}, ${ageH} ч назад`;
        return ageH < MAX_AGE_HOURS
          ? { ok: true, detail }
          : {
              ok: false,
              detail: `${detail} (норма — не старше ${MAX_AGE_HOURS} ч)`,
            };
      } catch (e) {
        const msg = (e as Error)?.message?.slice(0, 150) ?? 'сеть недоступна';
        return { ok: false, detail: `не удалось проверить бэкапы: ${msg}` };
      }
    },
  };
}
