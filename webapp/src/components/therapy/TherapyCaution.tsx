import { useEffect } from 'react';
import { ExternalLink } from '../../host/ExternalLink';
import { trackTherapyNudge } from './trackTherapyNudge';
import { useTherapyBridgeTexts } from './useTherapyBridgeTexts';
import { useTherapyTarget } from './useTherapyTarget';
import { Limits } from '../art/NeedArt';
import '../../styles/therapy-bridge.css';

/** Заметное предупреждение на входе в упражнение или тест: самопомощь, глубже — терапия. Терапевту не показывается.
 *  compact — наклейка (редизайн 2026-11): знак рамки метода Limits строчного размера (row 44×24; в nav 24×14
 *  рамка с точкой читалась пятном) рядом с «Это самопомощь, не замена
 *  терапии.», ниже тише — пояснение со ссылкой в конце строки (ссылка не отрывается от текста, переносится
 *  только фраза), без акцентной полосы; место под кнопками выбирает экран (ExScreen у героя). Убрать ли
 *  пояснение из наклейки — решение владельца (docs/design/APP_2026-11.md), до него текст на месте. */
export function TherapyCaution({ place, compact }: { place: 'exercise_start' | 'test_start'; compact?: boolean }) {
  const t = useTherapyBridgeTexts();
  const target = useTherapyTarget(place);
  const { hidden } = target;

  useEffect(() => {
    if (!hidden) trackTherapyNudge(place, 'shown');
  }, [place, hidden]);

  if (hidden) return null;

  const link = target.write ? (
    <ExternalLink className="th-link" href={target.write.url} onClick={target.write.onClick}>
      {t.linkWrite}
    </ExternalLink>
  ) : (
    <button type="button" className="th-link" onClick={target.open}>
      {t.linkTalk}
    </button>
  );
  return (
    <>
      {compact ? (
        <div className="th-caution th-caution--compact" role="note">
          <span className="th-caution-sign" aria-hidden="true"><Limits size="row" /></span>
          <p className="th-caution-lead">{t.cautionLead}</p>
          <p className="th-caution-body">{t.cautionBody} {link}</p>
        </div>
      ) : (
        <div className="th-caution" role="note">
          <p className="th-caution-lead">{t.cautionLead}</p>
          <p className="th-caution-body">{t.cautionBody}</p>
          {link}
        </div>
      )}
      {target.sheet}
    </>
  );
}
