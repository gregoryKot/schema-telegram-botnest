import { useEffect } from 'react';
import type { ModeDiaryEntry } from '../../../../shared/src/types';
import { SkeletonCard } from '../Skeleton';
import { TherapyBridgeCard } from './TherapyBridgeCard';
import { TherapyCardFrame } from './TherapyCardFrame';
import { trackTherapyNudge } from './trackTherapyNudge';
import { useTherapyBridgeTexts } from './useTherapyBridgeTexts';
import { useTherapySignal } from './useTherapySignal';
import { useTherapyTarget } from './useTherapyTarget';

/**
 * Карточка на главной, когда по данным видно: одной самопомощи может быть мало
 * (низкий индекс, повторяющийся режим, тяжёлый день). Нет сигнала — спокойная
 * карточка моста (TherapyBridgeCard); терапевту — пусто; до ответа истории — скелетон.
 * «Не сейчас» прячет её на 14 дней на этом устройстве.
 */
export function TherapyNudgeCard({
  refreshKey,
  modeEntries,
}: {
  refreshKey: number | undefined;
  modeEntries: ModeDiaryEntry[];
}) {
  const t = useTherapyBridgeTexts();
  const { signal, dismiss, ready } = useTherapySignal(refreshKey, modeEntries);
  const trigger = signal?.trigger;
  const target = useTherapyTarget('signal_card', trigger);

  useEffect(() => {
    if (trigger) trackTherapyNudge('signal_card', 'shown', trigger);
  }, [trigger]);

  if (target.hidden) return null;
  // Пока история не пришла — силуэт карточки, не спокойная версия с ложным показом.
  if (!ready) return <SkeletonCard height={150} radius={18} />;
  if (!signal) return <TherapyBridgeCard place="home_card" />;

  return (
    <TherapyCardFrame
      eyebrow={signal.eyebrow}
      title={t.cardTitle}
      target={target}
      extra={
        <button
          type="button"
          className="th-back"
          onClick={() => {
            trackTherapyNudge('signal_card', 'dismiss', signal.trigger);
            dismiss();
          }}
        >
          {t.cardLater}
        </button>
      }
    />
  );
}
