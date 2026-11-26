import { useState, type ReactNode } from 'react';
import { CaseStepScreen } from './CaseStepScreen';
import { clipPreview } from '../../sections/diary/entryPreview';
import {
  clearQuickDraft,
  loadQuickDraft,
} from '../../../../shared/src/case/quick/caseQuickDraft';

/** Сколько знаков начатой сцены видно на экране выбора. */
const SCENE_PREVIEW_MAX = 140;

/**
 * Возврат к начатому разбору «Что случилось». Черновик живёт без срока, и
 * раньше поток молча открывался на шаге недельной давности (бэклог «Разбор
 * случая, четыре дырки», п. 4). Теперь сначала выбор: продолжить или начать
 * заново (черновик стирается). Поток (`children`) монтируется после выбора:
 * useCaseQuickFlow читает черновик при старте. Вид — лист шалфея потока, начатый
 * момент — листок бумаги с цитатой, одна залитая кнопка и тихая.
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
    <CaseStepScreen
      onBack={onBack} backLabel="Закрыть" spread={false}
      eyebrow="Что случилось"
      title="Есть начатый разбор"
      lede="Можно продолжить с того же места или начать с чистого листа — тогда черновик сотрётся."
    >
      {scene && <p className="cq-draft">«{clipPreview(scene, SCENE_PREVIEW_MAX).text}»</p>}
      <div className="ex2-foot cq-foot cq-foot--pair">
        <button type="button" className="ds-btn" onClick={() => setDraft(null)}>
          Продолжить
        </button>
        <button type="button" className="ds-btn ex2-ghost" onClick={restart}>
          Начать заново
        </button>
      </div>
    </CaseStepScreen>
  );
}
