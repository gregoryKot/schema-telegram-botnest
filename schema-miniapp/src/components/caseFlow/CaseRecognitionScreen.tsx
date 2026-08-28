import { PrimaryAction } from '../diary/diaryFlowUi';
import { TertiaryLink } from './caseFlowUi';
import type { RecognitionView } from '../../../../shared/src/case/caseRecognition';

function ChainRow({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--faint)',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.4 }}>
        {text}
      </div>
    </div>
  );
}

/** Экран узнавания — ключевой экран потока: термин приходит здесь и только
 *  один раз (caseCount === 0), после того как человек уже узнал себя в
 *  цепочке собственных ответов, а не до этого. */
export function CaseRecognitionScreen({
  recognition,
  secondDoorNote,
  onNext,
  onDoubt,
}: {
  recognition: RecognitionView;
  secondDoorNote: string | null;
  onNext: () => void;
  onDoubt: () => void;
}) {
  const { chain, termParagraph, verdictReply, clinicalName } = recognition;
  const rows = [
    { label: 'Сцена', text: chain.scene },
    { label: 'Тело', text: chain.body },
    { label: 'Порыв', text: chain.impulse },
  ].filter((r) => r.text);

  return (
    <div>
      <div className="d-display" style={{ fontSize: 21, marginBottom: 16 }}>
        Вот что произошло
      </div>

      <div
        style={{
          background: 'var(--surface-2)',
          borderRadius: 'var(--r-14)',
          padding: 14,
          marginBottom: 16,
        }}
      >
        {rows.map((r, i) => (
          <div key={r.label}>
            <ChainRow label={r.label} text={r.text} />
            {i < rows.length - 1 && (
              <div
                style={{
                  textAlign: 'center',
                  color: 'var(--faint)',
                  fontSize: 14,
                  margin: '2px 0',
                }}
              >
                ↓
              </div>
            )}
          </div>
        ))}
      </div>

      {termParagraph && (
        <div
          style={{
            fontSize: 14,
            color: 'var(--text)',
            lineHeight: 1.6,
            marginBottom: 16,
          }}
        >
          {termParagraph}
        </div>
      )}

      <div
        style={{
          fontSize: 14,
          color: 'var(--accent)',
          lineHeight: 1.5,
          marginBottom: 12,
        }}
      >
        {verdictReply}
      </div>

      {secondDoorNote && (
        <div
          style={{
            fontSize: 13,
            color: 'var(--muted)',
            lineHeight: 1.5,
            marginBottom: 12,
          }}
        >
          {secondDoorNote}
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--faint)', marginBottom: 20 }}>
        {clinicalName}
      </div>

      <PrimaryAction label="Дальше" onClick={onNext} />
      <TertiaryLink label="У меня было иначе →" onClick={onDoubt} muted />
    </div>
  );
}
