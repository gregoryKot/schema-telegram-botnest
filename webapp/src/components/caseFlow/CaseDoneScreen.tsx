import { ExScreen } from '../exercises/ExScreen';
import { TherapyLine } from '../therapy/TherapyLine';
import { useTherapyBridgeTexts } from '../therapy/useTherapyBridgeTexts';

/** «Записано»: итог потока. Без примет — их нечем заполнить, пока разбор один. */
export function CaseDoneScreen({
  name,
  onOpenMap,
  onClose,
}: {
  name: string;
  onOpenMap: () => void;
  onClose: () => void;
}) {
  const bridge = useTherapyBridgeTexts();
  return (
    <ExScreen
      onBack={onClose}
      backLabel="Закрыть"
      eyebrow="Записано"
      title={name}
    >
      <p className="ds-sub ex2-gap-b">
        Теперь это есть в записях. Через 2–3 разбора видно, что повторяется.
      </p>
      <div className="ex2-foot">
        <button type="button" className="ds-btn" onClick={onClose}>
          На главную
        </button>
        <button type="button" className="ds-btn ex2-ghost" onClick={onOpenMap}>
          Карта себя
        </button>
      </div>
      <TherapyLine place="case_done" text={bridge.lineCase} />
    </ExScreen>
  );
}
