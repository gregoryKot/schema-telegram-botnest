// Обёртка над setTimeout для catch-up-таймера TelegramScheduleService.onModuleInit
// (вынесено в отдельный файл, чтобы не растить telegram.schedule.service.ts —
// он уже на потолке бейслайна, см. scripts/file-size-baseline.json, правило №10).
//
// isArmed()/clear() дают способ доказать (юнит- и e2e-тестом), что таймер
// снят на onModuleDestroy — иначе он стреляет в уже закрытый Prisma-пул
// после app.close() (флак e2e-джобы `migrations`: --runInBand гоняет
// несколько spec-файлов подряд в одном процессе, boot следующего не ждёт,
// пока умрёт unref'нутый таймер прошлого).
export class CatchupTimer {
  private handle: NodeJS.Timeout | null = null;

  arm(fn: () => void, delayMs: number): void {
    this.handle = setTimeout(fn, delayMs);
    this.handle.unref(); // не держать процесс (jest/e2e воркеры не выходили)
  }

  clear(): void {
    if (this.handle) clearTimeout(this.handle);
    this.handle = null;
  }

  isArmed(): boolean {
    return this.handle !== null;
  }
}
