// Финальный шаг разбора: вердикт (shared/src/phraseCheck/verdict) + поле для
// переписанной фразы + кризисный гейт (правило №7 CLAUDE.md — обязателен ДО
// сохранения) + предложение забрать ответ в «Тёплые слова».
import { GlyphCheck } from '../ExScreen';
import { detectCrisisAny } from '../../../utils/crisisMarkers';
import { CrisisCard } from '../../CrisisCard';
import { buildVerdict } from '../../../../../shared/src/phraseCheck/verdict';
import type { PhraseMarkId } from '../../../../../shared/src/phraseCheck/criteria';

export function PhraseRewriteStep({
  marks,
  rewrite,
  setRewrite,
  inWarmWords,
  setInWarmWords,
  saving,
  saveError,
  onSave,
  tr,
}: {
  marks: PhraseMarkId[];
  rewrite: string;
  setRewrite: (v: string) => void;
  inWarmWords: boolean;
  setInWarmWords: (v: boolean) => void;
  saving: boolean;
  saveError: boolean;
  onSave: () => void;
  tr: (ty: string, vy: string) => string;
}) {
  const verdict = buildVerdict(marks);
  return (
    <>
      <div className="ds-card ex2-note">
        <div className="ds-label">Вердикт</div>
        <h3 className="ex2-note-h">{verdict.title}</h3>
        <p className="ex2-note-body">{verdict.text}</p>
      </div>

      <div className="ex2-prompt">
        <div className="ex2-prompt-num">11.</div>
        <div>
          <div className="ex2-prompt-label ex2-prompt-label--sm">
            {verdict.suggestRewrite
              ? 'Как сказать то же самое иначе?'
              : 'Можно сохранить как есть'}
          </div>
          <p className="ex2-prompt-hint">
            {verdict.suggestRewrite
              ? tr(
                  'Скажи то же самое голосом, который помогает: что случилось (факт), на что это влияет, что делаешь дальше.',
                  'Скажите то же самое голосом, который помогает: что случилось (факт), на что это влияет, что делаете дальше.',
                )
              : 'Фраза уже звучит как забота о себе — можно оставить её образцом.'}
          </p>
        </div>
      </div>

      <textarea
        className="ds-textarea"
        value={rewrite}
        onChange={(e) => setRewrite(e.target.value)}
        placeholder="Например: отчёт ушёл с ошибкой в цифрах. Это неприятно, но поправимо — в следующий раз проверяю итоги дважды"
        rows={4}
      />
      {detectCrisisAny(rewrite) && <CrisisCard surface="phrase_check" />}

      <WarmWordsToggle rewrite={rewrite} checked={inWarmWords} onChange={setInWarmWords} />

      {saveError && (
        <div role="alert" className="ex2-err">
          {tr(
            'Не удалось сохранить разбор. Проверь связь и попробуй ещё раз',
            'Не удалось сохранить разбор. Проверьте связь и попробуйте ещё раз',
          )}
        </div>
      )}

      <div className="ex2-foot">
        <span className="ex2-spacer" />
        <button className="ds-btn" disabled={saving} onClick={onSave}>
          {saving ? 'Сохраняю...' : <>Сохранить разбор <GlyphCheck /></>}
        </button>
      </div>
    </>
  );
}

// Чекбокс+подпись — явная связка через htmlFor/id (аудит В7: формы дневника
// без label находили только по placeholder), а не общий <label>-обёртка
// checkbox+текст миниаппа (components/phraseCheck/RewriteStep.tsx) — те же
// checked/disabled/onChange, но другая разметка форм для двух разных
// визуальных языков фронтендов.
function WarmWordsToggle({
  rewrite,
  checked,
  onChange,
}: {
  rewrite: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const hasRewrite = Boolean(rewrite.trim());
  return (
    <div className={'ex2-check' + (hasRewrite ? '' : ' is-off')}>
      <input
        id="phrase-check-warm-words"
        type="checkbox"
        checked={checked && hasRewrite}
        disabled={!hasRewrite}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label htmlFor="phrase-check-warm-words">
        Добавить в «Тёплые слова»
        <small>
          Будет лежать вместе с другими словами поддержки — перечитать, когда снова накроет.
        </small>
      </label>
    </div>
  );
}
