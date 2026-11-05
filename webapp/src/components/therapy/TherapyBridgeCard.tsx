import { useEffect } from 'react';
import { TherapyCardFrame } from './TherapyCardFrame';
import { trackTherapyNudge } from './trackTherapyNudge';
import { useTherapyBridgeTexts } from './useTherapyBridgeTexts';
import { useTherapyTarget } from './useTherapyTarget';

/** Постоянная спокойная карточка моста: без условия по сигналу, для всех, кроме терапевта. */
export function TherapyBridgeCard({ place }: { place: 'home_card' | 'practice' }) {
  const t = useTherapyBridgeTexts();
  const target = useTherapyTarget(place);
  const { hidden } = target;

  useEffect(() => {
    if (!hidden) trackTherapyNudge(place, 'shown');
  }, [place, hidden]);

  if (hidden) return null;
  return <TherapyCardFrame eyebrow={t.cardEyebrowCalm} title={t.cardTitleCalm} target={target} />;
}
