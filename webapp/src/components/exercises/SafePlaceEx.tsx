import { useState } from 'react';
import { api } from '../../api';
import { ExScreen, GlyphCheck } from './ExScreen';
import { useHistorySheet } from '../../hooks/useHistorySheet';

const SENSES = [
  { k: 'see',   label: 'Что я вижу',           ph: 'высокие сосны, солнце сквозь ветки, мхом покрытый камень…' },
  { k: 'hear',  label: 'Что я слышу',           ph: 'шорох листьев, где-то птица, тишина…' },
  { k: 'feel',  label: 'Что я чувствую телом',  ph: 'тёплый ветер, шершавая кора под рукой, мягкая земля…' },
  { k: 'smell', label: 'Что я обоняю',           ph: 'хвоя, дождь, дым от далёкого костра…' },
] as const;

export function SafePlaceEx({ onBack, onComplete }: { onBack: () => void; onComplete?: () => void }) {
  const goBack = useHistorySheet(onBack);
  const [overview, setOverview] = useState('');
  const [senses, setSenses] = useState<Record<string, string>>({ see: '', hear: '', feel: '', smell: '' });
  const [done, setDone] = useState(false);

  const filled = overview.trim() && Object.values(senses).some(s => s.trim());
  function update(k: string, v: string) { setSenses(s => ({ ...s, [k]: v })); }

  async function save() {
    const desc = [overview, ...SENSES.filter(s => senses[s.k].trim()).map(s => `${s.label}: ${senses[s.k]}`)].join('\n');
    try { await api.saveSafePlace(desc); } catch {}
    onComplete?.();
    setDone(true);
  }

  if (done) {
    return (
      <ExScreen onBack={goBack} eyebrow="Безопасное место · сохранено" eyebrowColor="var(--c-moss)"
        title={<>Твоё<br/><span className="it">безопасное место.</span></>}
        lede="Возвращайся сюда, когда станет тревожно. Закрой глаза. Прочти. Побудь."
      >
        <div className="sp-scene">
          <div className="sp-scene-text">«{overview}»</div>
        </div>
        <div className="sp-sense-grid">
          {SENSES.map(s => senses[s.k].trim() ? (
            <div key={s.k} className="sp-sense">
              <div className="sp-sense-label"><span style={{ width: 6, height: 6, borderRadius: 3, background: 'currentColor' }} />{s.label}</div>
              <div style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.6 }}>{senses[s.k]}</div>
            </div>
          ) : null)}
        </div>
        <div className="ex-foot">
          <button className="ex-btn ex-btn-outline" onClick={() => setDone(false)}>Изменить</button>
          <span className="spacer" />
          <button className="ex-btn ex-btn-primary" onClick={goBack}>Закрыть</button>
        </div>
      </ExScreen>
    );
  }

  return (
    <ExScreen onBack={goBack} eyebrow="№ 05 · Ресурс" eyebrowColor="var(--c-moss)"
      title={<>Безопасное<br/><span className="it">место</span></>}
      lede="Опиши место, где тебе спокойно – реальное или воображаемое. Чтобы было куда вернуться мысленно, когда становится тревожно."
      aside={<>
        <div className="aside-card" style={{ borderColor: 'var(--c-moss)40', background: 'var(--c-moss)08' }}>
          <div className="aside-card-eyebrow" style={{ color: 'var(--c-moss)' }}>Совет</div>
          <h3>Конкретика важнее красоты</h3>
          <p className="body">«Дача у бабушки, веранда, скрипящие половицы» работает лучше, чем «прекрасный лес». Чем больше деталей – тем легче вернуться.</p>
        </div>
        <div className="aside-card">
          <div className="aside-card-eyebrow">Можно</div>
          <ul style={{ marginTop: 0 }}>
            <li>Реальное место – комната, лес, пляж</li>
            <li>Воображаемое – придуманный мир</li>
            <li>Воспоминание – момент из жизни</li>
          </ul>
        </div>
      </>}
    >
      <div className="sp-scene">
        <div className="sp-scene-text">{overview ? `«${overview}»` : 'Опиши общее впечатление от места ниже…'}</div>
      </div>
      <div className="ex-prompt" style={{ marginBottom: 32 }}>
        <div className="ex-prompt-num">1.</div>
        <div>
          <div className="ex-prompt-label">Что это за место?</div>
          <p className="ex-prompt-hint">Одно-два предложения. Общее впечатление.</p>
          <input className={'paper-input ' + (overview.trim() ? 'is-filled' : '')} value={overview} onChange={e => setOverview(e.target.value)} placeholder="Например: небольшая полянка в лесу, где играл в детстве…" autoFocus />
        </div>
      </div>
      <div className="ex-prompt" style={{ marginBottom: 18 }}>
        <div className="ex-prompt-num">2.</div>
        <div>
          <div className="ex-prompt-label">Через все органы чувств</div>
          <p className="ex-prompt-hint">Чем больше деталей, тем легче будет туда вернуться мысленно.</p>
        </div>
      </div>
      <div className="sp-sense-grid">
        {SENSES.map(s => (
          <div key={s.k} className="sp-sense">
            <div className="sp-sense-label"><span style={{ width: 6, height: 6, borderRadius: 3, background: 'currentColor' }} />{s.label}</div>
            <input className="sp-sense-input" value={senses[s.k]} onChange={e => update(s.k, e.target.value)} placeholder={s.ph} />
          </div>
        ))}
      </div>
      <div className="ex-foot">
        <span className="spacer" />
        <button className="ex-btn ex-btn-primary" disabled={!filled} onClick={save}>Сохранить место <GlyphCheck /></button>
      </div>
    </ExScreen>
  );
}
