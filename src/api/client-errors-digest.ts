import { Logger } from '@nestjs/common';
import { notifyAdminWithFallback } from '../utils/admin-alert';
import { SECTION_LABELS } from '../bot/client-error-metrics.format';
import type { ClientErrorSection } from './client-error-section';

// Сводка отчётов фронтенда владельцу — одним DM не чаще раза в час (аудит
// 2026-11, S13). Раньше каждый отчёт шёл logger.error → AlertLogger → DM, а
// POST /api/client-errors открыт без входа: 24 разных текста (раздел ×
// площадка), раз на IP в 5 минут — и ~5 IP каждую минуту выбирали общий
// бюджет DM (15/мин), настоящие ошибки сервера уходили в «подавлено ещё N».
// Теперь отчёт пишется warn (только лог), а сюда приходит счётчиком.
//
// Окно открывает первый отчёт: таймер на час, по нему — одна сводка, дальше
// окно открывает следующий отчёт. Пустой час — без сообщения. Инстансов может
// быть несколько — у каждого своя сводка (до одной в час на инстанс); точные
// числа за сутки и неделю — в /stats, блок «Поломки на клиенте» (из БД).
// Таймер unref: процесс не ждёт его при остановке, недосланное окно теряется
// (те же отчёты уже лежат в AnalyticsEvent).

export const DIGEST_PERIOD_MS = 3_600_000;
const TOP = 3;
const SUBJECT = '🧯 Сбои на сайте за час — SchemeHappens';

const label = (s: ClientErrorSection) =>
  s === 'auth' ? 'Вход в мессенджере' : SECTION_LABELS[s];

/** Текст сводки. Чистая функция: всего отчётов и счётчики по разделам. */
export function formatClientErrorDigest(
  total: number,
  bySection: ReadonlyMap<ClientErrorSection, number>,
): string {
  const top = [...bySection]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP)
    .map(([s, n]) => `${label(s)} — ${n}`)
    .join(', ');
  return (
    `🧯 Сайт сообщил о сбоях: ${total} за час.\n` +
    `Чаще всего: ${top}.\n` +
    'Подробности — в логах (ClientError) и в /stats, блок «Поломки на клиенте».'
  );
}

export class ClientErrorDigest {
  private readonly logger = new Logger(ClientErrorDigest.name);
  private total = 0;
  private readonly bySection = new Map<ClientErrorSection, number>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly send: (
      text: string,
      subject: string,
    ) => Promise<void> = notifyAdminWithFallback,
  ) {}

  /** Учесть отчёт; первый в окне заводит таймер сводки. */
  note(section: ClientErrorSection): void {
    this.total += 1;
    this.bySection.set(section, (this.bySection.get(section) ?? 0) + 1);
    if (this.timer) return;
    this.timer = setTimeout(() => this.flush(), DIGEST_PERIOD_MS);
    this.timer.unref?.();
  }

  private flush(): void {
    this.timer = null;
    if (this.total === 0) return;
    const text = formatClientErrorDigest(this.total, this.bySection);
    this.total = 0;
    this.bySection.clear();
    // Telegram, при отказе — письмо. Не доставилось — warn в лог (не error:
    // error ушёл бы в AlertLogger тем же каналом, что сейчас не работает).
    void this.send(text, SUBJECT).catch((e: unknown) =>
      this.logger.warn(`сводка ошибок фронтенда не доставлена: ${String(e)}`),
    );
  }
}
