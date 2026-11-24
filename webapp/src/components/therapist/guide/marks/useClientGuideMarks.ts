import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { api, type TherapyClientSummary, type UserId } from '../../../../api';
import { clientDisplayName } from '../../../../../../shared/src/therapy/clientInitials';
import type { GuideMark } from '../../../../../../shared/src/therapy/guideMarks/guideMarksApi';

/** Клиент, из карточки которого открыт справочник: отметка сразу его, без выбора. */
export interface GuideMarkClient { id: UserId; name: string }

export interface ClientGuideMarks {
  client: GuideMarkClient;
  /** undefined — грузится, null — не загрузилось. */
  marks: GuideMark[] | null | undefined;
  setMarks: Dispatch<SetStateAction<GuideMark[] | null | undefined>>;
  /** Перечитать отметки (после листа справочника, где их добавляли). */
  reload: () => void;
}

/** Отметки клиента (GET /api/therapy/guide-marks/:clientId); без клиента — ничего не грузит. */
export function useClientGuideMarks(client?: GuideMarkClient): ClientGuideMarks | undefined {
  const [marks, setMarks] = useState<GuideMark[] | null | undefined>(undefined);
  const [stamp, setStamp] = useState(0);
  const id = client?.id;
  useEffect(() => {
    if (id == null) return;
    let alive = true;
    api.getGuideMarks(id).then(
      (r) => { if (alive) setMarks(r.marks); },
      () => { if (alive) setMarks((m) => (stamp > 0 ? m : null)); },
    );
    return () => { alive = false; };
  }, [id, stamp]);
  return client && { client, marks, setMarks, reload: () => setStamp((n) => n + 1) };
}

/** Клиент карточки для отметок: id и подпись, как в списке клиентов. */
export function guideMarkClient(c: TherapyClientSummary | null | undefined): GuideMarkClient | undefined {
  return c ? { id: c.telegramId, name: clientDisplayName(c) } : undefined;
}
