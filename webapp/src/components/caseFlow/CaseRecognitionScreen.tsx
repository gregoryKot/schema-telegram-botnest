import { ExScreen } from '../exercises/ExScreen';
import { CaseFlowFoot } from './caseFlowUi';
import type { RecognitionView } from '../../../../shared/src/case/caseRecognition';

function ChainRow({ label, text }: { label: string; text: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-faint)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.4 }}>{text}</div>
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
    <ExScreen onBack={onLater} backLabel="Закрыть" eyebrow="Разбор случая" eyebrowColor="var(--accent-indigo)" title="Вот что произошло">
      <div className="aside-card" style={{ margin: '0 0 20px' }}>
        {rows.map((r) => (
          <ChainRow key={r.label} label={r.label} text={r.text} />
        ))}
      </div>

      {termParagraph && (
        <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6, marginBottom: 16 }}>
          {termParagraph}
        </p>
      )}

      <div style={{ fontSize: 14, color: 'var(--accent)', lineHeight: 1.5, marginBottom: 12 }}>
        {verdictReply}
      </div>

      {secondDoorNote && (
        <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5, marginBottom: 12 }}>
          {secondDoorNote}
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 8 }}>
        {clinicalName}
      </div>

      <CaseFlowFoot primaryLabel="Дальше" onPrimary={onNext} onLater={onLater} crisis={crisis} onHardNow={onHardNow} />
      <button type="button" className="ex-btn ex-btn-ghost" style={{ marginTop: 8 }} onClick={onDoubt}>
        У меня было иначе →
      </button>
    </ExScreen>
  );
}
