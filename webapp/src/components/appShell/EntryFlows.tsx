import { useCallback, useState } from 'react';
import { api, reportClientError } from '../../api';
import { useConsentGate } from '../../hooks/useConsentGate';
import { useStartParam } from '../../hooks/useStartParam';
import { cacheTherapistContact } from '../../utils/therapistContact';
import { ConsentScreen } from '../ConsentScreen';
import { JoinConfirmSheet } from '../JoinConfirmSheet';
import type { useOverlays } from './useOverlays';

interface Join { joinKind: 'pair' | 'therapy'; joinCode: string }

// Входы в кабинет из мессенджера (этап 2 docs/ONE_FRONTEND_PLAN.md): экран
// согласий при первом входе и параметр запуска (ссылки-приглашения, переходы в
// трекер). Ссылки обрабатываются только после согласий. Отдельный компонент,
// а не код в AppShell: файл на потолке размера (правило №10).
export function EntryFlows({ ov }: { ov: ReturnType<typeof useOverlays> }) {
  const consent = useConsentGate();
  const [join, setJoin] = useState<Join | null>(null);

  useStartParam(consent.state === 'done', (a) => {
    if (a.kind === 'join') setJoin({ joinKind: a.joinKind, joinCode: a.code });
    else if (a.kind === 'tracker') { ov.setTrackerNeedId(null); ov.setShowTrackerOverlay(true); }
  });

  const onJoined = useCallback((kind: 'pair' | 'therapy') => {
    // Пара закрывается сразу; терапевт — после «Понятно» на экране «Доступ
    // открыт» (JoinConfirmSheet, инцидент 2026-10-26: окно закрывалось молча).
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
    {consent.state === 'needed' && <ConsentScreen onAccept={consent.accept} failed={consent.failed} />}
    {join && <JoinConfirmSheet {...join} onClose={() => setJoin(null)} onJoined={onJoined} />}
  </>);
}
