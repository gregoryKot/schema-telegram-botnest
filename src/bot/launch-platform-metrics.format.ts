// Запуски сайта в мессенджере по платформам — хвост блока «Вход в мессенджере»
// /stats (правило №8). Чистый форматтер, покрыт тестом, включая пустую БД.
//
// Зачем: аудит 2026-10 — общее число входов почти не проседает, когда
// сломалась одна платформа (Telegram Web в iframe, MAX на компьютере), и
// поломку находил человек. Разбивка «эта неделя против прошлой» показывает
// платформу, с которой входить перестали. Событие — messenger_launch
// (src/analytics/launch-platforms.constants.ts).
import type {
  LaunchHost,
  LaunchPlatform,
} from '../analytics/launch-platforms.constants';

export interface LaunchPlatformRow {
  host: string;
  platform: string;
  /** Запусков за последние 7 дней. */
  week: number;
  /** Запусков за 7 дней до этого. */
  prevWeek: number;
}

const HOST_TITLES: Record<LaunchHost, string> = {
  telegram: 'Telegram',
  max: 'MAX',
};

// Платформы человеческими словами: в отчёте не должно быть внутренних id.
// Сверка с реестром — в спеке (новая платформа без подписи вылезла бы ключом).
export const LAUNCH_PLATFORM_LABELS: Record<LaunchPlatform, string> = {
  android: 'Android',
  android_x: 'Android, Telegram X',
  desktop: 'компьютер',
  ios: 'iPhone и iPad',
  macos: 'Mac',
  other: 'не определилась',
  tdesktop: 'компьютер',
  unigram: 'Windows, Unigram',
  web: 'браузер',
  weba: 'браузер, Web A',
  webk: 'браузер, Web K',
};

// С какого числа запусков на прошлой неделе тишина на этой — уже сигнал, а
// не случайность: один-два запуска в неделю пропадают и сами по себе.
const SILENCE_MIN_PREV = 3;

function label(row: LaunchPlatformRow): string {
  const host = HOST_TITLES[row.host as LaunchHost] ?? row.host;
  const platform =
    LAUNCH_PLATFORM_LABELS[row.platform as LaunchPlatform] ?? row.platform;
  return `${host} · ${platform}`;
}

/** Строки про платформы для блока «Вход в мессенджере». Чистая функция. */
export function formatLaunchPlatforms(rows: LaunchPlatformRow[]): string {
  const live = rows.filter((r) => r.week > 0 || r.prevWeek > 0);
  if (live.length === 0) {
    return 'Запусков из мессенджера по платформам пока нет — разбивка появится после первого входа.';
  }
  const sorted = [...live].sort(
    (a, b) => b.week - a.week || b.prevWeek - a.prevWeek,
  );
  const lines = ['Откуда открывают (за неделю, в скобках — неделей раньше):'];
  for (const r of sorted) {
    const silent = r.week === 0 && r.prevWeek >= SILENCE_MIN_PREV;
    const tail = silent
      ? ' — входить отсюда перестали, похоже, вход с этой платформы сломан'
      : '';
    lines.push(`${label(r)} — ${r.week} (${r.prevWeek})${tail}`);
  }
  return lines.join('\n');
}
