import { Probe } from './types';
import { BACKUP_RETENTION_MAX_DAYS, backupS3Config } from '../backup-config';
import { backupMisconfigResult } from '../backup-misconfig';
import { listObjects, S3Object } from '../s3-list-objects';

// Проба «бэкапы в Cloudflare R2 действительно делаются» (аудит D-2, правило
// №21). Скрипт бэкапа молчал годами, потому что его никто не вызывал и никто
// не спрашивал результат. Проба смотрит не на конфигурацию, а на итог: самый
// свежий файл schemehappens-*.sql.gz.enc в бакете (ListObjectsV2 по S3-API —
// тот же, которым бэкап туда пишет). Старше 36 ч — суточный прогон пропущен
// хотя бы раз и не наверстан (планировщик повторяет сбойный прогон каждый час).
// Второй вопрос — самая старая копия: политика конфиденциальности обещает, что
// копии живут не дольше BACKUP_RETENTION_MAX_DAYS, а сбой чистки скрипт бэкапа
// только пишет в stderr. Копия старше потолка (по дате в имени, как считает
// чистка) — обещание нарушено, проба красная.

const TIMEOUT_MS = 10_000;
const MAX_AGE_HOURS = 36;
const MAX_PAGES = 5;
/** Первый бэкап после включения делается через минуту после старта и идёт минуты — не тревожим. */
const FIRST_BACKUP_GRACE_SEC = 3600;
const PREFIX = 'schemehappens-';
const NAME_RE = /^schemehappens-(\d{4}-\d{2}-\d{2})\.sql\.gz\.enc$/;

type Env = Record<string, string | undefined>;

export interface BackupProbeDeps {
  fetchFn?: typeof fetch;
  now?: () => number;
  uptimeSec?: () => number;
}

const ddmm = (ms: number): string => {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}`;
};

/** Время файла: момент загрузки; нет его в ответе — полночь UTC даты из имени. */
const fileTime = (f: S3Object): number => {
  const at = Date.parse(f.lastModified);
  if (Number.isFinite(at)) return at;
  const date = NAME_RE.exec(f.key)?.[1] ?? '1970-01-01';
  return Date.parse(`${date}T00:00:00Z`);
};

/** Полночь UTC даты из имени — по ней считает срок чистка в backup-upload.sh. */
const nameDay = (f: S3Object): number =>
  Date.parse(`${NAME_RE.exec(f.key)?.[1] ?? '1970-01-01'}T00:00:00Z`);

export function backupFreshnessProbe(
  env: Env = process.env,
  deps: BackupProbeDeps = {},
): Probe {
  const now = deps.now ?? Date.now;
  const uptimeSec = deps.uptimeSec ?? (() => process.uptime());
  return {
    id: 'backupFreshness',
    title: 'Бэкапы БД в Cloudflare R2',
    critical: false,
    async run() {
      const misconfigured = backupMisconfigResult(env);
      if (misconfigured) return misconfigured;
      try {
        const all = await listObjects(backupS3Config(env), PREFIX, {
          fetchFn: deps.fetchFn,
          maxPages: MAX_PAGES,
          timeoutMs: TIMEOUT_MS,
        });
        const files = all.filter((f) => NAME_RE.test(f.key));
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
        if (ageH >= MAX_AGE_HOURS) {
          const norm = `норма — не старше ${MAX_AGE_HOURS} ч`;
          return { ok: false, detail: `${detail} (${norm})` };
        }
        const oldest = Math.min(...files.map(nameDay));
        const oldDays = Math.floor((now() - oldest) / 86_400_000);
        return oldDays <= BACKUP_RETENTION_MAX_DAYS
          ? { ok: true, detail }
          : {
              ok: false,
              detail:
                `${detail}; самая старая копия от ${ddmm(oldest)} — ${oldDays} дн., ` +
                `политика обещает не дольше ${BACKUP_RETENTION_MAX_DAYS}: чистка не сработала`,
            };
      } catch (e) {
        const msg = (e as Error)?.message?.slice(0, 150) ?? 'сеть недоступна';
        return { ok: false, detail: `не удалось проверить бэкапы: ${msg}` };
      }
    },
  };
}
