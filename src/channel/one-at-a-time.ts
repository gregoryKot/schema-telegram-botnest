/**
 * Один прогон за раз внутри процесса: пока предыдущий идёт, следующий не
 * начинается и сообщает «занято».
 *
 * R7 (аудит 2026-11): аренда CronLeaderService разводит инстансы, но о
 * собственном зависшем тике процесс не знает — окно аренды (4 мин) короче
 * зависшей отправки, и следующий тик честно забирал её снова. Он читал «когда
 * постили» до того, как первый тик записал пост, видел слот пустым и
 * публиковал его второй раз.
 *
 * Проверка и захват — синхронно, без await между ними: два тика одного
 * процесса не проскочат проверку вместе. `holder` — кто держит флаг: один
 * флаг на публикацию делят расписание и /zv (ChannelPublisherService.inFlight),
 * и отказ называет, чем занято.
 */
export class OneAtATime {
  private who: string | null = null;

  /** Кто сейчас держит флаг; null — свободно. */
  get holder(): string | null {
    return this.who;
  }

  /** Захват без ожидания: функция освобождения или null, если занято. */
  claim(who: string): (() => void) | null {
    if (this.who !== null) return null;
    this.who = who;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.who = null;
    };
  }

  /** false — предыдущий прогон ещё идёт, `job` не вызывался. */
  async run(job: () => Promise<void>, who = 'прогон'): Promise<boolean> {
    const release = this.claim(who);
    if (!release) return false;
    try {
      await job();
      return true;
    } finally {
      release();
    }
  }
}
