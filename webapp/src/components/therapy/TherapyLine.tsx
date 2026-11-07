import { useEffect } from 'react';
import type { TherapyNudgePlace } from '../../../../shared/src/analytics/therapyNudge';
import { ExternalLink } from '../../host/ExternalLink';
import { trackTherapyNudge } from './trackTherapyNudge';
import { useTherapyBridgeTexts } from './useTherapyBridgeTexts';
import { useTherapyTarget } from './useTherapyTarget';
import '../../styles/therapy-bridge.css';

interface Props {
  place: TherapyNudgePlace;
  /** Строка для клиента без своего терапевта; клиенту с терапевтом — lineTherapist (он уже в терапии). */
  text: string;
  /** Дописывается к th-line: место подгоняет строку под свою вёрстку (подпись листа «Зачем это всё»). */
  className?: string;
}

// Отличие от shared/src/components/TherapyNote.tsx (старые экраны, карточка-дисклеймер): здесь тихая строка с листом «Поговорить» и событиями аналитики.
export function TherapyLine({ place, text, className }: Props) {
  const t = useTherapyBridgeTexts();
  const target = useTherapyTarget(place);
  const { hidden } = target;

  useEffect(() => {
    if (!hidden) trackTherapyNudge(place, 'shown');
  }, [place, hidden]);

  if (hidden) return null;

  return (
    <>
      <p className={className ? `th-line ${className}` : 'th-line'}>
        {target.connected ? t.lineTherapist : text}{' '}
        {target.write ? (
          <ExternalLink className="th-link" href={target.write.url} onClick={target.write.onClick}>
            {t.linkWrite}
          </ExternalLink>
        ) : (
          <button type="button" className="th-link" onClick={target.open}>
            {t.linkTalk}
          </button>
        )}
      </p>
      {target.sheet}
    </>
  );
}
