import { useEffect, useState } from 'react';
import { api } from '../../api';
import { EMPTY_NOTES_PAGE, hiddenCount } from '../../../../shared/src/therapy/notesPage';
import { sessionWorkEntries } from '../../../../shared/src/therapy/sessionWork/sessionJournal';
import type { SessionWorkEntry } from '../../../../shared/src/therapy/sessionWork/types';
import type { ClientDetail } from './clientSheetTypes';

/**
 * Пункты «Что делали» всех сессий клиента — для журнала «На сессиях» и листа
 * техники. Показанные заметки карточка уже держит; ручку пунктов зовём, только
 * когда у клиента есть более ранние записи, которых страница заметок не отдала,
 * и заново — когда число записей изменилось. `failed` — ранние не загрузились.
 */
export function useSessionWork(detail: Pick<ClientDetail, 'selectedClient' | 'notesPage'>) {
  const page = detail.notesPage ?? EMPTY_NOTES_PAGE; // в тестах вкладок карточка бывает без заметок
  const clientId = detail.selectedClient?.telegramId;
  const key = clientId != null && hiddenCount(page) > 0 ? `${clientId}:${page.total}` : null;
  const [older, setOlder] = useState<{ key: string; entries: SessionWorkEntry[] | null } | null>(null);
  useEffect(() => {
    if (key === null || clientId == null) return;
    let live = true;
    api.getSessionWork(clientId).then(
      (r) => { if (live) setOlder({ key, entries: r.entries }); },
      () => { if (live) setOlder({ key, entries: null }); },
    );
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- clientId входит в key
  const current = older?.key === key ? older : null;
  return {
    entries: sessionWorkEntries(page, current?.entries ?? null),
    failed: current !== null && current.entries === null,
  };
}
