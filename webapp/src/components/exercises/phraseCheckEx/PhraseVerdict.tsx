// Вердикт разбора (b18) — лист бумаги со знаком голоса, а не белая карточка: критик — Looming на сливе,
// смешанный — Looming и Together вместе на соломе, забота — Together на мху (phraseLook: VERDICT_LOOK,
// verdictTone — по самому вердикту shared/src/phraseCheck/verdict.ts, без своих порогов).
import { SignArt } from '../../art/SignArt';
import { hueStyle } from '../../../lib/tone';
import { VERDICT_LOOK, verdictTone } from './phraseLook';
import type { PhraseVerdict as Verdict } from '../../../../../shared/src/phraseCheck/verdict';
import { ENTITY_LOOK } from '../../../../../shared/src/theme/entityLook';

export function PhraseVerdict({ verdict }: { verdict: Verdict }) {
  const tone = verdictTone(verdict);
  const look = VERDICT_LOOK[tone];
  return (
    <section className="pp-paper ex2-verdict" data-tone={tone} style={hueStyle(look.hue)}>
      <div className="ex2-verdict-signs" aria-hidden="true">
        {look.signs.map((s) => <SignArt key={s} sign={s} size="row" />)}
      </div>
      <div className="ex2-verdict-body">
        <div className="ds-label">Вердикт</div>
        <h3 className="ex2-note-h">{verdict.title}</h3>
        <p className="ex2-note-body">{verdict.text}</p>
      </div>
    </section>
  );
}

/** «Добавить в «Тёплые слова»»: строка со знаком «Тёплых слов» (ChildCare) и нормальным контрастом; без
 *  ответа — неактивна, но читается (раньше — бледная серым на сером, как выключенная навсегда).
 *  Связка подписи и флажка — htmlFor/id (аудит В7: формы без label находили только по placeholder). */
export function PhraseWarmToggle({ rewrite, checked, onChange }: {
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
      <SignArt sign={ENTITY_LOOK.warm_words.sign} size="row" />
      <label htmlFor="phrase-check-warm-words">
        Добавить в «Тёплые слова»
        <small>
          Будет лежать вместе с другими словами поддержки — перечитать, когда снова накроет.
        </small>
      </label>
    </div>
  );
}
