import { CrisisCard } from '../../CrisisCard';
import { TherapyLine } from '../../therapy/TherapyLine';
import { useTherapyBridgeTexts } from '../../therapy/useTherapyBridgeTexts';

/** Экран после сохранения: одна строка о том, куда запись попала, и два шага дальше. */
export function QuickDone({ crisis, onHome, onAgain }: { crisis: boolean; onHome: () => void; onAgain: () => void }) {
  const bridge = useTherapyBridgeTexts();
  return (
    <div className="tq-body">
      <div className="tq-inner tq-done">
        <p className="tq-eyebrow">Дневник</p>
        <h1 className="tq-title">Записано</h1>
        <p className="tq-obs">Теперь это есть в записях</p>
        {crisis && <CrisisCard surface="schema" />}
        <div className="tq-acts">
          <button type="button" className="tq-btn tq-btn--main" onClick={onHome}>На главную</button>
          <button type="button" className="tq-btn" onClick={onAgain}>Ещё одну</button>
        </div>
        <TherapyLine place="diary_done" text={bridge.lineDiary} />
      </div>
    </div>
  );
}
