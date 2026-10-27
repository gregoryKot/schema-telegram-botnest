import { useEffect } from 'react';
import type { TherapyNudgePlace } from '../../../../shared/src/analytics/therapyNudge';
import { ExternalLink } from '../../host/ExternalLink';
import { trackTherapyNudge } from './trackTherapyNudge';
import { useTherapyBridgeTexts } from './useTherapyBridgeTexts';
import { useTherapyTarget } from './useTherapyTarget';
import '../../styles/therapy-bridge.css';

// Отличие от shared/src/components/TherapyNote.tsx (старые экраны, карточка-дисклеймер): здесь тихая строка с листом «Поговорить» и событиями аналитики.
export function TherapyLine({ place, text }: { place: TherapyNudgePlace; text: string }) {
  const t = useTherapyBridgeTexts();
  const target = useTherapyTarget(place);
  const { hidden } = target;

  useEffect(() => {
    if (!hidden) trackTherapyNudge(place, 'shown');
  }, [place, hidden]);

  if (hidden) return null;

  return (
    <>
      <p className="th-line">
        {text}{' '}
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
