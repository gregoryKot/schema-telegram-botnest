import { useState, useEffect, useRef } from 'react';
import { api } from '../../api';
import { ExScreen, GlyphCheck } from './ExScreen';
import { SafePlaceDone } from './SafePlaceDone';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useSavingAction } from '../../hooks/useSavingAction';
import { useTr } from '../../utils/addressForm';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';
import { PaperAlert } from '../paper/PaperAlert';
import { HavenSenseMark, SceneHaven } from '../art/SceneHaven';
import { hueStyle } from '../../lib/tone';
import { EXERCISE_DRAFT_KEYS } from '../../utils/drafts';
import { restoreDraft, useDraftAutosave } from '../../../../shared/src/utils/useDraftAutosave';
import { exerciseCard } from '../../../../shared/src/exercises/exerciseCatalog';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { ExHint, ExHintList, ExHintSub, ExHintText } from './ExHint';
import { glueSpaces } from '../../../../shared/src/utils/typo';
import { LimitedTextarea } from '../../../../shared/src/components/LimitedTextarea';
import { SENSES, SAFE_PLACE_FIELD_MAX, buildSafePlaceDescription } from './safePlaceText';

// Вид (редизайн 2026-11, b18): герой — лист шалфея со сценой SceneHaven: место собирается из того, что
// описано (назвал место — своя часть в рамке, каждое чувство — свой элемент), на компьютере — разворот,
// сцена растёт слева, пока заполняются поля справа. «Совет» и «Можно» — общая ExHint (на телефоне свёрнута); номера
// вопросов — над вопросом, а не колонкой; чувства — тетрадью, а не четырьмя карточками. Итог — SafePlaceDone.
export function SafePlaceEx({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete?: () => void;
}) {
  const tr = useTr();
  const goBack = useHistorySheet(onBack);
  const [draft] = useState(() => restoreDraft<{ overview: string; senses: Record<string, string> }>(EXERCISE_DRAFT_KEYS.safePlace));
  const [overview, setOverview] = useState(draft?.overview ?? '');
  const [senses, setSenses] = useState<Record<string, string>>({ see: '', hear: '', feel: '', smell: '', ...draft?.senses });
  const [done, setDone] = useState(false);
  const overviewRef = useRef<HTMLTextAreaElement>(null);
  const clearDraft = useDraftAutosave(EXERCISE_DRAFT_KEYS.safePlace, { overview, senses });

  useEffect(() => {
    if (!done) overviewRef.current?.focus();
  }, [done]);

  const filled = overview.trim() && Object.values(senses).some((s) => s.trim());
  function update(k: string, v: string) {
    setSenses((s) => ({ ...s, [k]: v }));
  }

  // Раньше сбой saveSafePlace намеренно глотался («best-effort») и экран
  // всё равно показывал «готово» — тот же экран-тупик, что нашли в
  // FlashcardEx (аудит 2026-08-22, находка №2): человек уходит с уверенностью,
  // что место сохранено, а на деле запрос не прошёл. Плюс не было защиты от
  // двойного нажатия. useSavingAction — общий примитив (см. его комментарий).
  const { saving, error, run } = useSavingAction();
  async function save() {
    const desc = buildSafePlaceDescription(overview, senses);
    const ok = await run(() => api.saveSafePlace(desc));
    if (ok) { clearDraft(); onComplete?.(); setDone(true); }
  }

  if (done) {
    return (
      <SafePlaceDone overview={overview} senses={senses} onEdit={() => setDone(false)} onClose={goBack}
        title={<>{tr('Твоё', 'Ваше')} <span className="it">безопасное место.</span></>}
        lede={tr(
          'Возвращайся сюда, когда станет тревожно. Закрой глаза. Прочти. Побудь.',
          'Возвращайтесь сюда, когда станет тревожно. Закройте глаза. Прочтите. Побудьте.',
        )} />
    );
  }

  const described = Object.fromEntries(SENSES.map((s) => [s.k, Boolean(senses[s.k].trim())]));
  return (
    <ExScreen
      onBack={goBack} caution spread look="safe_place"
      heroArt={<SceneHaven place={Boolean(overview.trim())} senses={described} />}
      heroFoot={overview.trim() ? <p className="ex2-haven-name">«{glueSpaces(overview)}»</p> : undefined}
      eyebrow={exerciseCard('safe').eyebrow}
      title={
        <>
          Безопасное
          <br />
          <span className="it">место</span>
        </>
      }
      lede={tr(
        'Опиши место, где тебе спокойно – реальное или воображаемое. Чтобы было куда вернуться мысленно, когда становится тревожно.',
        'Опишите место, где вам спокойно – реальное или воображаемое. Чтобы было куда вернуться мысленно, когда становится тревожно.',
      )}
      aside={
        <ExHint label="Совет" title="Конкретика важнее красоты">
          <ExHintText>«Дача у бабушки, веранда, скрипящие половицы» работает лучше, чем «прекрасный лес». Чем больше деталей – тем легче вернуться.</ExHintText>
          <ExHintSub>Можно</ExHintSub>
          <ExHintList items={['Реальное место – комната, лес, пляж', 'Воображаемое – придуманный мир', 'Воспоминание – момент из жизни']} />
        </ExHint>
      }
    >
      <div className="ex2-safe" style={hueStyle(ENTITY_LOOK.safe_place.hue)}>
        <div className="ex2-ask">
          <span className="ex2-ask-n">1.</span>
          <div className="ex2-prompt-label">Что это за место?</div>
          <p className="ex2-prompt-hint">
            Одно-два предложения. Общее впечатление.
          </p>
          <LimitedTextarea
            max={SAFE_PLACE_FIELD_MAX}
            ref={overviewRef}
            rows={2}
            className="pa-field ex2-place-input"
            value={overview}
            onChange={(e) => setOverview(e.target.value)}
            placeholder="Например: небольшая полянка в лесу, где было спокойно в детстве…"
          />
        </div>
        <div className="ex2-ask">
          <span className="ex2-ask-n">2.</span>
          <div className="ex2-prompt-label">Через все органы чувств</div>
          <p className="ex2-prompt-hint">
            Чем больше деталей, тем легче будет туда вернуться мысленно.
          </p>
        </div>
        {/* Чувства — тетрадью на белом листе: метка элемента сцены (пустым тоном, пока поле пусто), подпись
            и поле без своей рамки; подпись связана с полем, а не только плейсхолдером. Поле — textarea с той же
            механикой, что «Что это за место?» (field-sizing, 1–3 строки): подсказка и ответ читаются целиком. */}
        <div className="ex2-senses">
          {SENSES.map((s) => (
            <div key={s.k} className="ex2-sense">
              <span className="ex2-sense-head">
                <HavenSenseMark sense={s.k} on={described[s.k]} />
                <label className="ds-label" htmlFor={`safe-place-${s.k}`}>{s.label}</label>
              </span>
              <LimitedTextarea id={`safe-place-${s.k}`} max={SAFE_PLACE_FIELD_MAX} rows={2} className="ex2-sense-input" value={senses[s.k]}
                onChange={(e) => update(s.k, e.target.value)} placeholder={s.ph} />
            </div>
          ))}
        </div>
      </div>
      {detectCrisisAny(overview, senses.see, senses.hear, senses.feel, senses.smell) && (
        <CrisisCard surface="safe_place" />
      )}
      {error && (
        <PaperAlert sign="haven" className="ex2-alert" title={tr('Не удалось сохранить. Проверь связь и попробуй ещё раз.', 'Не удалось сохранить. Проверьте связь и попробуйте ещё раз.')} />
      )}
      <div className="ex2-foot">
        <span className="ex2-spacer" />
        <button
          className="ds-btn"
          disabled={!filled || saving}
          onClick={save}
        >
          {saving ? 'Сохраняю…' : <>Сохранить место <GlyphCheck /></>}
        </button>
      </div>
    </ExScreen>
  );
}
