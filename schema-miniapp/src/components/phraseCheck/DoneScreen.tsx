// Финальный экран разбора: было → стало. Смысл упражнения виден именно на
// этом экране, поэтому обе фразы показываются рядом, дословно.
import { BottomSheet } from '../BottomSheet';
import { buildVerdict } from './verdict';
import type { PhraseMarkId } from './criteria';

export function PhraseDoneScreen({
  phrase,
  marks,
  rewrite,
  onClose,
  tr,
}: {
  phrase: string;
  marks: PhraseMarkId[];
  rewrite: string;
  onClose: () => void;
  tr: (ty: string, vy: string) => string;
}) {
  const verdict = buildVerdict(marks);
  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4, textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>{verdict.emoji}</div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 6,
          }}
        >
          Разобрано
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-sub)',
            lineHeight: 1.5,
            marginBottom: 20,
          }}
        >
          {rewrite.trim()
            ? tr(
                'Голос, который помогает, ставится тренировкой. Чем чаще переписываешь, тем быстрее он приходит сам.',
                'Голос, который помогает, ставится тренировкой. Чем чаще переписываете, тем быстрее он приходит сам.',
              )
            : tr(
                'Даже просто заметить приметы — уже работа. Переписать можно в любой момент.',
                'Даже просто заметить приметы — уже работа. Переписать можно в любой момент.',
              )}
        </div>

        <div
          style={{
            background: 'color-mix(in srgb, var(--accent-red) 6%, transparent)',
            border:
              '1px solid color-mix(in srgb, var(--accent-red) 14%, transparent)',
            borderRadius: 16,
            padding: '13px 15px',
            textAlign: 'left',
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: 'var(--accent-red)',
              marginBottom: 5,
            }}
          >
            БЫЛО
          </div>
          <div
            style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-sub)' }}
          >
            «{phrase}»
          </div>
        </div>

        {rewrite.trim() && (
          <div
            style={{
              background:
                'color-mix(in srgb, var(--accent-green) 6%, transparent)',
              border:
                '1px solid color-mix(in srgb, var(--accent-green) 16%, transparent)',
              borderRadius: 16,
              padding: '13px 15px',
              textAlign: 'left',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                color: 'var(--accent-green)',
                marginBottom: 5,
              }}
            >
              СТАЛО
            </div>
            <div
              style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text)' }}
            >
              «{rewrite}»
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="btn-primary"
          style={{ width: '100%' }}
        >
          Готово
        </button>
      </div>
    </BottomSheet>
  );
}
