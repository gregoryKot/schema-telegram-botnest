import { useState, useEffect, useRef } from 'react';
import { api } from '../../api';
import { ExScreen, GlyphCheck } from './ExScreen';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useSavingAction } from '../../hooks/useSavingAction';
import { useTr } from '../../utils/addressForm';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';
import { hueStyle, DIARY_HUE } from '../../lib/tone';

// Безопасное место — ресурс, тон «здорового» (зелёный) как у благодарности.
const SAFE_HUE = DIARY_HUE.gratitude;

const SENSES = [
  {
    k: 'see',
    label: 'Что я вижу',
    ph: 'высокие сосны, солнце сквозь ветки, мхом покрытый камень…',
  },
  {
    k: 'hear',
    label: 'Что я слышу',
    ph: 'шорох листьев, где-то птица, тишина…',
  },
  {
    k: 'feel',
    label: 'Что я чувствую телом',
    ph: 'тёплый ветер, шершавая кора под рукой, мягкая земля…',
  },
  {
    k: 'smell',
    label: 'Что я обоняю',
    ph: 'хвоя, дождь, дым от далёкого костра…',
  },
] as const;

export function SafePlaceEx({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete?: () => void;
}) {
  const tr = useTr();
  const goBack = useHistorySheet(onBack);
  const [overview, setOverview] = useState('');
  const [senses, setSenses] = useState<Record<string, string>>({
    see: '',
    hear: '',
    feel: '',
    smell: '',
  });
  const [done, setDone] = useState(false);
  const overviewRef = useRef<HTMLInputElement>(null);

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
    const desc = [
      overview,
      ...SENSES.filter((s) => senses[s.k].trim()).map(
        (s) => `${s.label}: ${senses[s.k]}`,
      ),
    ].join('\n');
    const ok = await run(() => api.saveSafePlace(desc));
    if (ok) { onComplete?.(); setDone(true); }
  }

  if (done) {
    return (
      <ExScreen
        onBack={goBack}
        eyebrow="Безопасное место · сохранено"
          title={
          <>
            {tr('Твоё', 'Ваше')}
            <br />
            <span className="it">безопасное место.</span>
          </>
        }
        lede={tr(
          'Возвращайся сюда, когда станет тревожно. Закрой глаза. Прочти. Побудь.',
          'Возвращайтесь сюда, когда станет тревожно. Закройте глаза. Прочтите. Побудьте.',
        )}
      >
        <div className="ds-card ds-card--ink ex2-done ex2-scene">
          <div className="ex2-scene-text">«{overview}»</div>
        </div>
        <div className="ex2-senses">
          {SENSES.map((s) =>
            senses[s.k].trim() ? (
              <div key={s.k} className="ds-card ds-card--row">
                <div className="ds-label ex2-sense-label">
                  <span className="ds-dot tone-fill" style={hueStyle(SAFE_HUE)} />
                  {s.label}
                </div>
                <div className="ex2-body-text">{senses[s.k]}</div>
              </div>
            ) : null,
          )}
        </div>
        <div className="ex2-foot">
          <button
            className="ds-btn ds-btn--secondary"
            onClick={() => setDone(false)}
          >
            Изменить
          </button>
          <span className="ex2-spacer" />
          <button className="ds-btn" onClick={goBack}>
            Закрыть
          </button>
        </div>
      </ExScreen>
    );
  }

  return (
    <ExScreen
      onBack={goBack}
      eyebrow="№ 05 · Ресурс"
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
        <>
          <div className="ds-card ex2-note ex2-tint" style={hueStyle(SAFE_HUE)}>
            <div className="ds-label">Совет</div>
            <h3 className="ex2-note-h">Конкретика важнее красоты</h3>
            <p className="ex2-note-body">
              «Дача у бабушки, веранда, скрипящие половицы» работает лучше, чем
              «прекрасный лес». Чем больше деталей – тем легче вернуться.
            </p>
          </div>
          <div className="ds-card ex2-note">
            <div className="ds-label">Можно</div>
            <ul className="ex2-note-list">
              <li>Реальное место – комната, лес, пляж</li>
              <li>Воображаемое – придуманный мир</li>
              <li>Воспоминание – момент из жизни</li>
            </ul>
          </div>
        </>
      }
    >
      <div className="ds-card ex2-scene">
        <div className="ex2-scene-text">
          {overview
            ? `«${overview}»`
            : tr(
                'Опиши общее впечатление от места ниже…',
                'Опишите общее впечатление от места ниже…',
              )}
        </div>
      </div>
      <div className="ex2-prompt">
        <div className="ex2-prompt-num">1.</div>
        <div>
          <div className="ex2-prompt-label">Что это за место?</div>
          <p className="ex2-prompt-hint">
            Одно-два предложения. Общее впечатление.
          </p>
          <input
            ref={overviewRef}
            className="ds-input"
            value={overview}
            onChange={(e) => setOverview(e.target.value)}
            placeholder="Например: небольшая полянка в лесу, где было спокойно в детстве…"
          />
        </div>
      </div>
      <div className="ex2-prompt">
        <div className="ex2-prompt-num">2.</div>
        <div>
          <div className="ex2-prompt-label">Через все органы чувств</div>
          <p className="ex2-prompt-hint">
            Чем больше деталей, тем легче будет туда вернуться мысленно.
          </p>
        </div>
      </div>
      <div className="ex2-senses">
        {SENSES.map((s) => (
          <div key={s.k} className="ds-card ds-card--row">
            <div className="ds-label ex2-sense-label">
              <span className="ds-dot tone-fill" style={hueStyle(SAFE_HUE)} />
              {s.label}
            </div>
            <input
              className="ds-input"
              value={senses[s.k]}
              onChange={(e) => update(s.k, e.target.value)}
              placeholder={s.ph}
            />
          </div>
        ))}
      </div>
      {detectCrisisAny(overview, senses.see, senses.hear, senses.feel, senses.smell) && (
        <CrisisCard surface="safe_place" />
      )}
      {error && (
        <div role="alert" className="ex2-err">
          {tr('Не удалось сохранить. Проверь связь и попробуй ещё раз', 'Не удалось сохранить. Проверьте связь и попробуйте ещё раз')}
        </div>
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
