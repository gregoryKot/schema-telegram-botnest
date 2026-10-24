// Правило гейта «alarm видит каждую джобу своего воркфлоу» (правило №24,
// аудит 2026-10). Джоба alarm сообщает только о тех, кто стоит у неё в
// `needs:`: новая ночная джоба, забытая в этом списке, падает молча, как
// nightly до появления alarm. Чистая функция над текстом воркфлоу; разбор
// джоб — workflow-yaml.ts. Образцы и прогон по nightly.yml/prod-smoke.yml —
// alarm-needs.spec.ts.
import { jobBlocks } from './workflow-yaml';

/** Список `needs:` джобы: скаляр, `[a, b]` или блочный список. */
export function jobNeeds(job: string): string[] {
  const lines = job.split('\n');
  const at = lines.findIndex((l) => /^ {4}needs:/.test(l));
  if (at < 0) return [];
  const inline = lines[at].replace(/^ {4}needs:/, '').trim();
  if (inline) {
    return inline
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map((n) => n.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
  }
  const out: string[] = [];
  for (const l of lines.slice(at + 1)) {
    const m = /^ {6}-\s+['"]?([\w-]+)['"]?\s*$/.exec(l);
    if (!m) break;
    out.push(m[1]);
  }
  return out;
}

export interface AlarmGaps {
  /** Джобы воркфлоу, о падении которых alarm не узнает. */
  missing: string[];
  /** Имена в needs, которых нет среди джоб. */
  unknown: string[];
}

/** Сверка `alarm.needs` со всеми остальными джобами воркфлоу. */
export function alarmNeedsGaps(text: string): AlarmGaps {
  const jobs = jobBlocks(text);
  if (!jobs.alarm) throw new Error('джобы alarm нет');
  const needs = new Set(jobNeeds(jobs.alarm));
  const others = Object.keys(jobs).filter((j) => j !== 'alarm');
  return {
    missing: others.filter((j) => !needs.has(j)).sort(),
    unknown: [...needs].filter((n) => !others.includes(n)).sort(),
  };
}
