import { useMemo, useState } from 'react';
import { api, reportClientError } from '../../../../api';
import { useTimedFlag } from '../../../../../../shared/src/hooks/useTimedFlag';
import { useGuide } from '../../../../../../shared/src/therapy/conceptGraph/guideLoader';
import type { GuideMark } from '../../../../../../shared/src/therapy/guideMarks/guideMarksApi';
import { sameId } from '../../../../../../shared/src/utils/sameId';
import { useTr } from '../../../../utils/addressForm';
import type { GuideMarkCtx } from './GuideSectionMark';
import { GuideMarkSheet } from './GuideMarkSheet';
import { dropMark, upsertMark } from './guideMarkModel';
import type { ClientGuideMarks, GuideMarkClient } from './useClientGuideMarks';

/**
 * «Про клиента» на листах справочника (#1484): `ctx` — провайдер для разделов (GuideSectionMark),
 * `node` — лист отметки и тост. С отметками клиента (`store`, справочник из карточки) его отметки
 * подсвечены и правятся сразу, без выбора клиента. Сохранение и снятие — сразу на экране, ошибка —
 * тост и откат.
 */
export function useGuideMarking(store?: ClientGuideMarks) {
  const tr = useTr();
  const guide = useGuide();
  const [selected, select] = useState<string | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [toastOn, flashToast] = useTimedFlag(2400);
  const say = (text: string) => { setToast(text); flashToast(); };
  const own = (client: GuideMarkClient) => !!store && sameId(client.id, store.client.id);
  const marked = useMemo(() => new Map((store?.marks ?? []).map((m) => [m.address, m])), [store?.marks]);

  const save = (client: GuideMarkClient, address: string, note: string) => {
    const snapshot = guide?.resolveAddress(address, tr)?.text;
    if (!snapshot) return;
    const before = store?.marks;
    const now = new Date().toISOString();
    const draft: GuideMark = marked.get(address) ?? { id: -1, clientId: String(client.id), address, note: null, snapshot, createdAt: now, updatedAt: now };
    if (own(client)) store?.setMarks((l) => upsertMark(l ?? [], { ...draft, note: note.trim() || null, snapshot }));
    select(null);
    say(`Отмечено у ${client.name}`);
    api.saveGuideMark(client.id, { address, snapshot, note: note.trim() }).then(
      ({ mark }) => { if (own(client)) store?.setMarks((l) => upsertMark(l ?? [], mark)); },
      () => {
        if (own(client)) store?.setMarks(before);
        reportClientError({ message: 'guide mark save failed', section: 'therapist.guide' });
        say('Не удалось сохранить отметку');
      },
    );
  };

  const remove = (mark: GuideMark, client?: GuideMarkClient) => {
    if (mark.id < 0) return; // ещё не сохранилась
    const before = store?.marks;
    const mine = !client || own(client);
    if (mine) store?.setMarks((l) => dropMark(l ?? [], mark.id));
    select(null);
    say('Отметка снята');
    api.deleteGuideMark(mark.id).catch(() => {
      if (mine) store?.setMarks(before);
      reportClientError({ message: 'guide mark remove failed', section: 'therapist.guide' });
      say('Не удалось снять отметку');
    });
  };

  const ctx: GuideMarkCtx = {
    selected, select,
    client: store && { name: store.client.name, marked },
    onMark: setSheet,
    onUnmark: (mark) => remove(mark),
  };
  const found = sheet ? guide?.resolveAddress(sheet, tr) : null;
  const node = (
    <>
      {sheet && found && (
        <GuideMarkSheet
          address={sheet} title={`${found.articleTitle} · ${found.sectionTitle}`}
          client={store?.client} existing={marked.get(sheet)}
          onSave={(client, note) => save(client, sheet, note)} onRemove={remove} onClose={() => setSheet(null)}
        />
      )}
      {toastOn && <div className="gd-mark-toast" role="status">{toast}</div>}
    </>
  );
  return { ctx, node, remove };
}
