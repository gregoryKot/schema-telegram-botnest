import { useEffect } from 'react';
import { api, reportClientError } from '../api';

/**
 * Повтор очереди отложенных оценок, когда вернулась сеть. На старте очередь
 * уходит в useBootstrapLoad, но если сеть легла уже после старта, оценки
 * копились до следующего открытия сайта — в мини-аппе (useOutboxFlush)
 * очередь едет по событию `online`, здесь так же. Хук живёт внутри
 * авторизованного AppShell, поэтому очередь не уедет в чужой аккаунт.
 */
export function useOutboxFlushOnOnline(): void {
  useEffect(() => {
    const onOnline = () => {
      api.flushOutbox().catch(() =>
        reportClientError({ message: 'outbox flush on online failed', section: 'outbox' }),
      );
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);
}
