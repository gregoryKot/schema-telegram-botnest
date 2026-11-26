import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import type { UserId } from '../../../../shared/src/userId';
import type { TherapistNoteOne } from '../../../../shared/src/api/entryApi';
import { SkeletonLines } from '../Skeleton';
import { SessionNoteRow } from './SessionNoteRow';
import { hasCustomMode, useCustomModeNames } from './useCustomModeNames';

/**
 * Запись сессии за пределами страницы заметок (сервер отдаёт последние 100):
 * к ней пришли из журнала «На сессиях», поэтому она грузится по id и встаёт
 * под архивом, в конце — она раньше всех показанных.
 */
export function EarlySessionNote({ clientId, noteId, onDelete }: {
  clientId: UserId; noteId: number;
  /** «Удалить» в строке: подтверждение и само удаление — у архива, общие с показанными записями. */
  onDelete?: (found: TherapistNoteOne) => void;
}) {
  // undefined — грузится, null — не загрузилась.
  const [found, setFound] = useState<TherapistNoteOne | null>();
  const [attempt, setAttempt] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const customModes = useCustomModeNames(!!found && hasCustomMode(found.note.work));
  useEffect(() => {
    let live = true;
    api.getTherapistNote(clientId, noteId).then(
      (r) => { if (live) setFound(r); },
      () => { if (live) setFound(null); },
    );
    return () => { live = false; };
  }, [clientId, noteId, attempt]);
  useEffect(() => { ref.current?.scrollIntoView?.({ block: 'center' }); }, [found]);

  if (found) return <SessionNoteRow rowRef={ref} note={found.note} number={found.number} focus customModes={customModes} onDelete={onDelete && (() => onDelete(found))} />;
  return (
    <div ref={ref}>
      <div className="ds-label">Более ранняя запись</div>
      {found === undefined ? <SkeletonLines widths={['40%', '90%', '70%']} /> : (
        <div className="tb-journal-empty">
          <div className="tb-meta" role="status">Запись не загрузилась.</div>
          <button type="button" className="tb-journal-link" onClick={() => { setFound(undefined); setAttempt((n) => n + 1); }}>Повторить</button>
        </div>
      )}
    </div>
  );
}
