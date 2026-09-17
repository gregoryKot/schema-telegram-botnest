// Финальный экран разбора: было → стало, обе фразы дословно рядом; отсюда же
// делятся разбором (краткой карточкой или целиком).
import { BottomSheet } from '../BottomSheet';
import { SaveErrorNote } from '../SaveErrorNote';
import { PhraseCheckShare } from './PhraseCheckShare';
import { QuoteCard } from './QuoteCard';
import { buildVerdict } from '../../../../shared/src/phraseCheck/verdict';
import type { PhraseMarkId } from '../../../../shared/src/phraseCheck/criteria';

export function PhraseDoneScreen({
  phrase,
  marks,
  rewrite,
  onClose,
  tr,
  saveError,
}: {
  phrase: string;
  marks: PhraseMarkId[];
  rewrite: string;
  onClose: () => void;
  tr: (ty: string, vy: string) => string;
  saveError?: boolean;
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

        <QuoteCard label="БЫЛО" color="var(--accent-red)" text={phrase} />
        {rewrite.trim() && (
          <QuoteCard
            label="СТАЛО"
            color="var(--accent-green)"
            text={rewrite}
            bright
          />
        )}

        <PhraseCheckShare
          phrase={phrase}
          marks={marks}
          rewrite={rewrite.trim() || undefined}
        />

        {saveError && (
          <SaveErrorNote
            ty="Не удалось сохранить разбор на сервере — в истории его не будет. Текст выше ещё виден, можешь скопировать вручную."
            vy="Не удалось сохранить разбор на сервере — в истории его не будет. Текст выше ещё виден, можете скопировать вручную."
          />
        )}

        <button
          onClick={onClose}
          className="btn-primary"
          style={{ width: '100%', marginTop: 14 }}
        >
          Готово
        </button>
      </div>
    </BottomSheet>
  );
}
