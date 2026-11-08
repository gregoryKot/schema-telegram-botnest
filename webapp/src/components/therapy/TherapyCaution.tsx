import { useEffect } from 'react';
import { ExternalLink } from '../../host/ExternalLink';
import { trackTherapyNudge } from './trackTherapyNudge';
import { useTherapyBridgeTexts } from './useTherapyBridgeTexts';
import { useTherapyTarget } from './useTherapyTarget';
import { Limits } from '../art/NeedArt';
import '../../styles/therapy-bridge.css';

/** Заметное предупреждение на входе в упражнение или тест: самопомощь, глубже — терапия. Терапевту не показывается.
 *  compact — наклейка-строка (редизайн 2026-11): знак рамки метода Limits, «Это самопомощь, не замена
 *  терапии.» и ссылка, без пояснения и акцентной полосы; место под кнопками выбирает экран. */
export function TherapyCaution({ place, compact }: { place: 'exercise_start' | 'test_start'; compact?: boolean }) {
  const t = useTherapyBridgeTexts();
  const target = useTherapyTarget(place);
  const { hidden } = target;

  useEffect(() => {
    if (!hidden) trackTherapyNudge(place, 'shown');
  }, [place, hidden]);

  if (hidden) return null;

  return (
    <>
      <div className={compact ? 'th-caution th-caution--compact' : 'th-caution'} role="note">
        {compact && <span className="th-caution-sign" aria-hidden="true"><Limits size="nav" /></span>}
        <p className="th-caution-lead">{t.cautionLead}</p>
        {!compact && <p className="th-caution-body">{t.cautionBody}</p>}
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
