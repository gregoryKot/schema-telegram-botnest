import { useEffect } from 'react';
import type { ModeDiaryEntry } from '../../../../shared/src/types';
import { ExternalLink } from '../../host/ExternalLink';
import { trackTherapyNudge } from './trackTherapyNudge';
import { useTherapyBridgeTexts } from './useTherapyBridgeTexts';
import { useTherapySignal } from './useTherapySignal';
import { useTherapyTarget } from './useTherapyTarget';
import '../../styles/therapy-bridge.css';

/**
 * Карточка на главной, когда по данным видно: одной самопомощи может быть мало
 * (низкий индекс, повторяющийся режим, тяжёлый день). Нет сигнала — нет карточки.
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
  const { signal, dismiss } = useTherapySignal(refreshKey, modeEntries);
  const trigger = signal?.trigger;
  const target = useTherapyTarget('signal_card', trigger);

  useEffect(() => {
    if (trigger) trackTherapyNudge('signal_card', 'shown', trigger);
  }, [trigger]);

  if (!signal) return null;

  return (
    <section className="th-card" aria-label={t.cardTalk}>
      <div className="ds-eyebrow">{signal.eyebrow}</div>
      <h2 className="th-card-title">{t.cardTitle}</h2>
      <p className="th-card-sub">{target.write ? t.cardSubTherapist : t.cardSubAuthor}</p>
      <div className="th-card-acts">
        {target.write ? (
          <ExternalLink className="ds-btn th-btn" href={target.write.url} onClick={target.write.onClick}>
            {t.cardWrite}
          </ExternalLink>
        ) : (
          <button type="button" className="ds-btn th-btn" onClick={target.open}>
            {t.cardTalk}
          </button>
        )}
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
      </div>
      {target.sheet}
    </section>
  );
}
