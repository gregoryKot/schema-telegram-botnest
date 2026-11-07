import { useState, type ReactNode } from 'react';
import { ExScreen } from '../exercises/ExScreen';
import { clipPreview } from '../../sections/diary/entryPreview';
import {
  clearQuickDraft,
  loadQuickDraft,
} from '../../../../shared/src/case/quick/caseQuickDraft';
import '../../styles/case-quick.css';

/** Сколько знаков начатой сцены видно на экране выбора. */
const SCENE_PREVIEW_MAX = 140;

/**
 * Возврат к начатому разбору «Что случилось». Черновик живёт без срока, и
 * раньше поток молча открывался на шаге недельной давности (бэклог «Разбор
 * случая, четыре дырки», п. 4). Теперь сначала выбор: продолжить или начать
 * заново (черновик стирается). Поток (`children`) монтируется после выбора:
 * useCaseQuickFlow читает черновик при старте.
 */
export function CaseResumeGate({
  onBack,
  children,
}: {
  onBack: () => void;
  children: ReactNode;
}) {
  const [draft, setDraft] = useState(loadQuickDraft);
  if (!draft) return <>{children}</>;
  const scene = (draft.scene ?? '').trim();
  const restart = () => {
    clearQuickDraft();
    setDraft(null);
  };
  return (
    <ExScreen
      onBack={onBack}
      backLabel="Закрыть"
      eyebrow="Что случилось"
      title="Есть начатый разбор"
    >
      {scene && (
        <p className="ds-sub cq-desc">
          «{clipPreview(scene, SCENE_PREVIEW_MAX).text}»
        </p>
      )}
      <p className="ds-sub ex2-gap-b">
        Можно продолжить с того же места или начать с чистого листа — тогда
        черновик сотрётся.
      </p>
      <div className="ex2-foot">
        <button type="button" className="ds-btn" onClick={() => setDraft(null)}>
          Продолжить
        </button>
        <button type="button" className="ds-btn ex2-ghost" onClick={restart}>
          Начать заново
        </button>
      </div>
    </ExScreen>
  );
}
