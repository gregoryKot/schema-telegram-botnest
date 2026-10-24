import { ExScreen } from '../exercises/ExScreen';
import { CaseFlowFoot } from './caseFlowUi';
import type { RecognitionView } from '../../../../shared/src/case/caseRecognition';

function ChainRow({ label, text }: { label: string; text: string }) {
  return (
    <div className="ex2-trait">
      <div className="ds-label">{label}</div>
      <div className="ex2-trait-text">{text}</div>
    </div>
  );
}

/**
 * Экран узнавания — ключевой экран потока: термин приходит здесь и только
 * один раз (caseCount === 0). Twin schema-miniapp CaseRecognitionScreen.tsx.
 */
export function CaseRecognitionScreen({
  recognition,
  secondDoorNote,
  onNext,
  onDoubt,
  onLater,
  crisis,
  onHardNow,
}: {
  recognition: RecognitionView;
  secondDoorNote: string | null;
  onNext: () => void;
  onDoubt: () => void;
  onLater: () => void;
  crisis: boolean;
  onHardNow: () => void;
}) {
  const { chain, termParagraph, verdictReply, clinicalName } = recognition;
  const rows = [
    { label: 'Сцена', text: chain.scene },
    { label: 'Тело', text: chain.body },
    { label: 'Порыв', text: chain.impulse },
  ].filter((r) => r.text);

  return (
    <ExScreen onBack={onLater} backLabel="Закрыть" eyebrow="Разбор случая" title="Вот что произошло">
      <div className="ds-card ds-card--ink ex2-chain">
        {rows.map((r) => (
          <ChainRow key={r.label} label={r.label} text={r.text} />
        ))}
      </div>

      {termParagraph && <p className="ex2-body-text ex2-gap-b">{termParagraph}</p>}

      <div className="ex2-verdict">{verdictReply}</div>

      {secondDoorNote && <div className="ds-sub ex2-gap-b">{secondDoorNote}</div>}

      <div className="ds-label ex2-gap-b">{clinicalName}</div>

      <CaseFlowFoot primaryLabel="Дальше" onPrimary={onNext} onLater={onLater} crisis={crisis} onHardNow={onHardNow} />
      <button type="button" className="ds-btn ex2-ghost" onClick={onDoubt}>
        У меня было иначе →
      </button>
    </ExScreen>
  );
}
