import { useEffect, useState } from 'react';
import { hideBridgeCard, isBridgeCardHidden } from '../../../../shared/src/therapy/bridge/therapyBridgeState';
import { PAPER_HUE } from '../../../../shared/src/theme/entityLook';
import { TherapyCardFrame } from './TherapyCardFrame';
import { TherapyCardSign } from './TherapyCardSign';
import { trackTherapyNudge } from './trackTherapyNudge';
import { useTherapyBridgeTexts } from './useTherapyBridgeTexts';
import { useTherapyTarget } from './useTherapyTarget';

/** Постоянная спокойная карточка моста: без условия по сигналу, для всех, кроме терапевта.
 *  «Скрыть» убирает её насовсем на этом устройстве — и в «Ещё», и в «Практиках»; вход остаётся строкой «Поговорить с кем-то» в «Ещё». */
export function TherapyBridgeCard({ place }: { place: 'home_card' | 'practice' }) {
  const t = useTherapyBridgeTexts();
  const target = useTherapyTarget(place);
  const [userHid, setUserHid] = useState(isBridgeCardHidden);
  const hidden = target.hidden || userHid;

  useEffect(() => {
    if (!hidden) trackTherapyNudge(place, 'shown');
  }, [place, hidden]);

  if (hidden) return null;
  return (
    <TherapyCardFrame
      eyebrow={t.cardEyebrowCalm}
      title={t.cardTitleCalm}
      target={target}
      hue={PAPER_HUE.sage}
      quiet={place === 'practice'}
      sign={<TherapyCardSign />}
      extra={
        <button
          type="button"
          className="th-back"
          onClick={() => {
            trackTherapyNudge(place, 'dismiss');
            hideBridgeCard();
            setUserHid(true);
          }}
        >
          {t.cardHide}
        </button>
      }
    />
  );
}
