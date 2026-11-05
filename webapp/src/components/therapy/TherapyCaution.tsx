import { useEffect } from 'react';
import { ExternalLink } from '../../host/ExternalLink';
import { trackTherapyNudge } from './trackTherapyNudge';
import { useTherapyBridgeTexts } from './useTherapyBridgeTexts';
import { useTherapyTarget } from './useTherapyTarget';
import '../../styles/therapy-bridge.css';

/** Заметное предупреждение на входе в упражнение или тест: самопомощь, глубже — терапия. Терапевту не показывается. */
export function TherapyCaution({ place }: { place: 'exercise_start' | 'test_start' }) {
  const t = useTherapyBridgeTexts();
  const target = useTherapyTarget(place);
  const { hidden } = target;

  useEffect(() => {
    if (!hidden) trackTherapyNudge(place, 'shown');
  }, [place, hidden]);

  if (hidden) return null;

  return (
    <>
      <div className="th-caution" role="note">
        <p className="th-caution-lead">{t.cautionLead}</p>
        <p className="th-caution-body">{t.cautionBody}</p>
        {target.write ? (
          <ExternalLink className="th-link" href={target.write.url} onClick={target.write.onClick}>
            {t.linkWrite}
          </ExternalLink>
        ) : (
          <button type="button" className="th-link" onClick={target.open}>
            {t.linkTalk}
          </button>
        )}
      </div>
      {target.sheet}
    </>
  );
}
