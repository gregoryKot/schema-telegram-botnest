import { useCallback, useEffect, useState } from 'react';
import { api, reportClientError } from '../../api';
import { useConsentGate } from '../../hooks/useConsentGate';
import { useStartParam } from '../../hooks/useStartParam';
import { cacheTherapistContact } from '../../utils/therapistContact';
import { AddressFormPicker } from '../AddressFormPicker';
import { ConsentScreen } from '../ConsentScreen';
import { JoinConfirmSheet } from '../JoinConfirmSheet';
import { entryStep } from './entryQueue';
import type { useOverlays } from './useOverlays';

interface Join { joinKind: 'pair' | 'therapy'; joinCode: string }

// Входы в кабинет (этап 2 docs/archive/ONE_FRONTEND_PLAN.md) — очередью, а не стопкой: вопрос «ты/вы» →
// согласия при первом входе → параметр запуска (ссылка-приглашение, трекер). Порядок и «один слой
// за раз» — entryQueue.ts (QA 2026-11, A-З7); конец очереди уходит в onDone, по нему открываются
// автопоказы «Сегодня». Отдельный компонент: AppShell на потолке размера (№10).
export function EntryFlows({ ov, onDone }: { ov: ReturnType<typeof useOverlays>; onDone: (done: boolean) => void }) {
  const consent = useConsentGate();
  const [addressDone, setAddressDone] = useState(false);
  const [linkHandled, setLinkHandled] = useState(false);
  const [join, setJoin] = useState<Join | null>(null);
  const step = entryStep({ addressDone, consent: consent.state, linkHandled, join: join !== null });

  useStartParam(addressDone && consent.state === 'done', (a) => {
    if (a.kind === 'join') setJoin({ joinKind: a.joinKind, joinCode: a.code });
    else if (a.kind === 'tracker') { ov.setTrackerNeedId(null); ov.setShowTrackerOverlay(true); }
  }, () => setLinkHandled(true));

  useEffect(() => { if (step === 'done') onDone(true); }, [step, onDone]);
  const onAddressDone = useCallback(() => setAddressDone(true), []);

  const onJoined = useCallback((kind: 'pair' | 'therapy') => {
    // Пара закрывается сразу; терапевт — после «Понятно» на «Доступ открыт» (инцидент 2026-10-26).
    if (kind === 'pair') setJoin(null);
    // Связь с терапевтом кэшируется для «Написать терапевту»; пара читается
    // листом настроек при каждом открытии, держать копию негде.
    if (kind === 'therapy') {
      api.getTherapyRelation().then((rel) => cacheTherapistContact({
        role: 'CLIENT', partnerId: rel?.partnerId ?? null, partnerName: rel?.partnerName ?? null, myId: null, myName: null,
      })).catch(() => reportClientError({ message: 'join therapy: связь не обновилась', section: 'appshell.bootstrap' }));
    }
  }, []);

  return (<>
    {step === 'address' && <AddressFormPicker onDone={onAddressDone} />}
    {step === 'consent' && <ConsentScreen onAccept={consent.accept} failed={consent.failed} />}
    {step === 'join' && join && <JoinConfirmSheet {...join} onClose={() => setJoin(null)} onJoined={onJoined} />}
  </>);
}
