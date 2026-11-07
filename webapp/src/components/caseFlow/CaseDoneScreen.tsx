import { Ribbon } from '../art/PaperArt';
import { ExScreen } from '../exercises/ExScreen';
import { TherapyLine } from '../therapy/TherapyLine';
import { useTherapyBridgeTexts } from '../therapy/useTherapyBridgeTexts';
import { CaseSupportBlock } from './CaseSupportFoot';

/**
 * «Записано»: итог потока. Без примет — их нечем заполнить, пока разбор один.
 * Карточка поддержки — как на каждом шаге (правило №7): кризисный текст,
 * набранный в разборе, после сохранения никуда не делся, и экран итога
 * обязан её показать, а не только мелькнуть ею на время сохранения.
 */
export function CaseDoneScreen({
  name,
  onOpenMap,
  onClose,
  crisis,
  onHardNow,
}: {
  name: string;
  onOpenMap: () => void;
  onClose: () => void;
  crisis: boolean;
  onHardNow: () => void;
}) {
  const bridge = useTherapyBridgeTexts();
  return (
    <ExScreen onBack={onClose} backLabel="Закрыть" eyebrow="Записано" title={name}>
      <div className="pp-paper cq-done">
        <Ribbon size="square" />
        <p className="ds-sub">
          Теперь это есть в записях. Через 2–3 разбора видно, что повторяется.
        </p>
      </div>
      <div className="ex2-foot">
        <button type="button" className="ds-btn" onClick={onClose}>
          На главную
        </button>
        <button type="button" className="ds-btn ex2-ghost" onClick={onOpenMap}>
          Карта себя
        </button>
      </div>
      <CaseSupportBlock crisis={crisis} onHardNow={onHardNow} />
      <TherapyLine place="case_done" text={bridge.lineCase} />
    </ExScreen>
  );
}
