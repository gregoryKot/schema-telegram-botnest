// Открытая запись «Моего пути» как вложенный уровень истории: «Назад» (Android)
// закрывает запись, а не весь лист (QA 2026-11, C-З2). Состояние записи живёт в
// общем useJourneyDetail (shared), поэтому запись в историю кладёт этот слой,
// пока запись открыта; все закрытия внутри идут через goBack.
import { useEffect, type MutableRefObject } from 'react';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { JourneyDetailPane } from '../../../../shared/src/journey/JourneyDetailPane';
import type { JourneyDetailState } from '../../../../shared/src/journey/JourneyItemDetail';

type PaneProps = Parameters<typeof JourneyDetailPane>[0];

export function JourneyDetailLayer({ detail, closeRef, ...rest }: PaneProps & {
  /** Родитель закрывает запись снаружи (после удаления) именно через неё. */
  closeRef: MutableRefObject<() => void>;
}) {
  const goBack = useHistorySheet(detail.close);
  useEffect(() => {
    const prev = closeRef.current;
    closeRef.current = () => goBack();
    return () => { closeRef.current = prev; };
  });
  const layered: JourneyDetailState = { ...detail, close: () => goBack() };
  return <JourneyDetailPane detail={layered} {...rest} />;
}
