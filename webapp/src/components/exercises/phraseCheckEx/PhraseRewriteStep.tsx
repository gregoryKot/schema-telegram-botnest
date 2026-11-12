// Финальный шаг разбора: вердикт (shared/src/phraseCheck/verdict) + поле для переписанной фразы +
// кризисный гейт (правило №7 CLAUDE.md — обязателен ДО сохранения) + предложение забрать ответ в
// «Тёплые слова». Вид (b18) — разговор: вердикт листом со знаком голоса (PhraseVerdict), исходная фраза
// репликой «Было» (переписывали по памяти), поле «стало» — лист с тенью мха. При «самокоррекции» поле
// свёрнуто под тихую ссылку: экран не спорит с собственным «Можно сохранить как есть».
import { useState } from 'react';
import { GlyphCheck } from '../ExScreen';
import { detectCrisisAny } from '../../../utils/crisisMarkers';
import { CrisisCard } from '../../CrisisCard';
import { PaperAlert } from '../../paper/PaperAlert';
import { hueStyle } from '../../../lib/tone';
import { SignArt } from '../../art/SignArt';
import { PhraseSaid } from './PhraseSaid';
import { PhraseVerdict, PhraseWarmToggle } from './PhraseVerdict';
import { CARE_LOOK } from './phraseLook';
import { buildVerdict } from '../../../../../shared/src/phraseCheck/verdict';
import type { PhraseMarkId } from '../../../../../shared/src/phraseCheck/criteria';
import { LimitedTextarea } from '../../../../../shared/src/components/LimitedTextarea';
import { EXERCISE_TEXT_MAX } from '../../../../../shared/src/limits/textLimits';

const ASK_REWRITE = 'Как сказать то же самое иначе?';

export function PhraseRewriteStep({
  phrase,
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
  phrase: string;
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
  // Самокоррекция: поле — по просьбе (или уже начатый ответ из черновика), а не пустым приглашением.
  const [open, setOpen] = useState(verdict.suggestRewrite || Boolean(rewrite.trim()));
  return (
    <>
      <PhraseVerdict verdict={verdict} />
      <PhraseSaid label="Было" text={phrase} />

      <div className="ex2-prompt-label ex2-prompt-label--sm">
        {verdict.suggestRewrite ? ASK_REWRITE : 'Можно сохранить как есть'}
      </div>
      <p className="ex2-prompt-hint">
        {verdict.suggestRewrite
          ? tr(
              'Скажи то же самое голосом, который помогает: что случилось (факт), на что это влияет, что делаешь дальше.',
              'Скажите то же самое голосом, который помогает: что случилось (факт), на что это влияет, что делаете дальше.',
            )
          : 'Фраза уже звучит как забота о себе — можно оставить её образцом.'}
      </p>

      {open ? (
        <div className="ex2-now" style={hueStyle(CARE_LOOK.hue)}>
          <label className="ds-label ex2-said-label" htmlFor="phrase-check-rewrite">
            <SignArt sign={CARE_LOOK.sign} size="nav" />Стало
          </label>
          <LimitedTextarea
            id="phrase-check-rewrite"
            max={EXERCISE_TEXT_MAX}
            className="pa-field"
            value={rewrite}
            onChange={(e) => setRewrite(e.target.value)}
            placeholder="Например: отчёт ушёл с ошибкой в цифрах. Это неприятно, но поправимо — в следующий раз проверяю итоги дважды"
            rows={4}
          />
          {detectCrisisAny(rewrite) && <CrisisCard surface="phrase_check" />}
          <PhraseWarmToggle rewrite={rewrite} checked={inWarmWords} onChange={setInWarmWords} />
        </div>
      ) : (
        <button type="button" className="ds-link pa-quiet ex2-open" onClick={() => setOpen(true)}>{ASK_REWRITE}</button>
      )}

      {saveError && (
        <PaperAlert sign="looming" className="ex2-alert" title={tr(
          'Не удалось сохранить разбор. Проверь связь и попробуй ещё раз',
          'Не удалось сохранить разбор. Проверьте связь и попробуйте ещё раз',
        )} />
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
