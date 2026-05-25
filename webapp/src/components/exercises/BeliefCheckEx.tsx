import { useState, useEffect } from 'react';
import { api } from '../../api';
import { ExScreen, StepsBar, GlyphArrowLeft, GlyphArrowRight, GlyphCheck, GlyphPlus, GlyphX } from './ExScreen';

const STEPS = ['Убеждение', 'Доказательства за', 'Доказательства против', 'Переформулировка'];

const SIDE_HINTS: Record<number, { title: string; body: string; list: string[] }> = {
  0: { title: 'Что такое убеждение схемы', body: 'Схемы говорят голосом абсолютных утверждений. Слушай слова «всегда», «никогда», «никто», «все», «должен» — это маркеры.', list: ['«я всегда всё порчу»', '«меня никто не любит»', '«если ошибусь — это конец»'] },
  1: { title: 'Будь честен', body: 'Не отмахивайся от мысли. Запиши все факты, которые её подтверждают — даже неприятные. Это не значит что она правдива.', list: ['Конкретные ситуации', 'Слова других людей', 'Твои ощущения тогда'] },
  2: { title: 'Что упустила схема', body: 'Схема — фильтр, который выбрасывает то, что ей противоречит. Восстанови баланс. Вспомни исключения, факты, чужие точки зрения.', list: ['Случаи, где было иначе', 'Люди, которые видят тебя другим', 'Что сказал бы друг?'] },
  3: { title: 'Не позитив, а точность', body: 'Не «всё хорошо» — это не работает. Сформулируй точнее: с оговорками, с признанием сложности, с состраданием.', list: ['«иногда я ошибаюсь, и это»', '«часть из этого правда, и»', '«я устал, и это не значит»'] },
};

function fmtAgo(d: string): string {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return 'сегодня';
  if (days === 1) return 'вчера';
  if (days < 7) return `${days} дн. назад`;
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function BeliefCheckEx({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(0);
  const [belief, setBelief] = useState('');
  const [forList, setForList] = useState<string[]>([]);
  const [againstList, setAgainstList] = useState<string[]>([]);
  const [reframe, setReframe] = useState('');
  const [forInput, setForInput] = useState('');
  const [againstInput, setAgainstInput] = useState('');
  const [done, setDone] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (done) api.getBeliefChecks().then(h => setHistory(h.slice(0, 4))).catch(() => {});
  }, [done]);

  const completed = [
    belief.trim() ? 0 : -1,
    forList.length > 0 ? 1 : -1,
    againstList.length > 0 ? 2 : -1,
    reframe.trim() ? 3 : -1,
  ].filter(x => x >= 0);

  function addFor() { const v = forInput.trim(); if (!v) return; setForList(l => [...l, v]); setForInput(''); }
  function addAgainst() { const v = againstInput.trim(); if (!v) return; setAgainstList(l => [...l, v]); setAgainstInput(''); }

  async function saveAll() {
    try { await api.createBeliefCheck({ belief, evidenceFor: forList, evidenceAgainst: againstList, reframe }); } catch {}
    setDone(true);
  }

  const pastChecks = history.filter(h => h.belief !== belief).slice(0, 3);

  if (done) {
    return (
      <ExScreen onBack={onBack} eyebrow="Проверка убеждения · сохранено" eyebrowColor="var(--c-moss)"
        title={<>Готово.<br/><span className="it">Мысль проверена.</span></>}
        lede="Иногда достаточно увидеть доказательства, чтобы мысль потеряла силу. Сохранено в дневнике."
        aside={<>
          <div className="aside-card">
            <div className="aside-card-eyebrow">Что попробовать дальше</div>
            <h3>Знакомство со схемой</h3>
            <p className="body">Если эта мысль возвращается часто — стоит копнуть, какая схема за ней стоит.</p>
          </div>
          {pastChecks.length > 0 && (
            <div className="aside-card">
              <div className="aside-card-eyebrow">Прошлые проверки · {history.length}</div>
              {pastChecks.map((h, i) => (
                <div key={i} className="history-row">
                  <span className="history-date">{fmtAgo(h.createdAt)}</span>
                  <span className="history-snippet">«{h.belief}»</span>
                </div>
              ))}
            </div>
          )}
        </>}
      >
        <div className="done-card">
          <div className="stamp"><GlyphCheck /> Сохранено · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</div>
          <div className="dlabel">Убеждение</div>
          <div className="belief-line">«{belief}»</div>
          <div className="done-cols">
            <div>
              <div className="dlabel" style={{ color: 'var(--c-rose)' }}>За · {forList.length}</div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{forList.map((f, i) => <li key={i} style={{ fontSize: 14, color: 'var(--text-sub)', padding: '3px 0' }}>· {f}</li>)}</ul>
            </div>
            <div>
              <div className="dlabel" style={{ color: 'var(--c-moss)' }}>Против · {againstList.length}</div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{againstList.map((a, i) => <li key={i} style={{ fontSize: 14, color: 'var(--text-sub)', padding: '3px 0' }}>· {a}</li>)}</ul>
            </div>
          </div>
          {reframe.trim() && (<>
            <div className="dlabel" style={{ color: 'var(--accent)' }}>Точнее</div>
            <div className="reframe-line">«{reframe}»</div>
          </>)}
        </div>
        <div className="ex-foot">
          <button className="ex-btn ex-btn-outline" onClick={() => { setDone(false); setStep(0); setBelief(''); setForList([]); setAgainstList([]); setReframe(''); }}>Проверить ещё одну</button>
          <span className="spacer" />
          <button className="ex-btn ex-btn-primary" onClick={onBack}>Закрыть</button>
        </div>
      </ExScreen>
    );
  }

  const hint = SIDE_HINTS[step];
  return (
    <ExScreen onBack={onBack} eyebrow="№ 01 · Когнитивная работа" eyebrowColor="var(--c-slate)"
      title={<>Проверка<br/><span className="it">убеждения</span></>}
      lede="Поставь одну мысль перед судом фактов. Что её подтверждает, что опровергает, и как сформулировать точнее."
      aside={
        <div className="aside-card">
          <div className="aside-card-eyebrow">Шаг {step + 1} из 4</div>
          <h3>{hint.title}</h3>
          <p className="body">{hint.body}</p>
          <ul>{hint.list.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
      }
    >
      <StepsBar steps={STEPS} current={step} completed={completed} onJump={setStep} />

      {step === 0 && (<>
        <div className="ex-prompt">
          <div className="ex-prompt-num">1.</div>
          <div>
            <div className="ex-prompt-label">Запиши мысль, которую хочешь проверить</div>
            <p className="ex-prompt-hint">Одно убеждение за раз. Та самая фраза, которая повторяется в голове.</p>
            <textarea className={'paper-area ' + (belief.trim() ? 'is-filled' : '')} rows={3} value={belief} onChange={e => setBelief(e.target.value)} placeholder="Например: я всегда всё порчу, меня никто не любит…" autoFocus />
          </div>
        </div>
        <div className="ex-foot"><span className="spacer" /><button className="ex-btn ex-btn-primary" disabled={!belief.trim()} onClick={() => setStep(1)}>Дальше · доказательства за <GlyphArrowRight /></button></div>
      </>)}

      {step === 1 && (<>
        <div className="ex-prompt"><div className="ex-prompt-num">2.</div><div>
          <div className="ex-prompt-label">Что подтверждает «<span style={{ color: 'var(--c-rose)' }}>{belief}</span>»?</div>
          <p className="ex-prompt-hint">Будь честен. Не убеждай себя, что мысль не имеет оснований — она их имеет.</p>
        </div></div>
        <EviList items={forList} onRemove={i => setForList(l => l.filter((_, j) => j !== i))} input={forInput} onInput={setForInput} onAdd={addFor} placeholder="Добавить доказательство…" />
        <div className="ex-foot"><button className="ex-btn ex-btn-ghost" onClick={() => setStep(0)}><GlyphArrowLeft /> Назад</button><span className="spacer" /><button className="ex-btn ex-btn-primary" disabled={forList.length === 0} onClick={() => setStep(2)}>Дальше · доказательства против <GlyphArrowRight /></button></div>
      </>)}

      {step === 2 && (<>
        <div className="ex-prompt"><div className="ex-prompt-num">3.</div><div>
          <div className="ex-prompt-label">Что опровергает «<span style={{ color: 'var(--c-moss)' }}>{belief}</span>»?</div>
          <p className="ex-prompt-hint">Вспомни факты, исключения, другие точки зрения. Что сказал бы хороший друг?</p>
        </div></div>
        <EviList items={againstList} onRemove={i => setAgainstList(l => l.filter((_, j) => j !== i))} input={againstInput} onInput={setAgainstInput} onAdd={addAgainst} placeholder="Добавить контр-доказательство…" />
        <div className="ex-foot"><button className="ex-btn ex-btn-ghost" onClick={() => setStep(1)}><GlyphArrowLeft /> Назад</button><span className="spacer" /><button className="ex-btn ex-btn-primary" disabled={againstList.length === 0} onClick={() => setStep(3)}>Дальше · переформулировка <GlyphArrowRight /></button></div>
      </>)}

      {step === 3 && (<>
        <div className="ex-prompt"><div className="ex-prompt-num">4.</div><div>
          <div className="ex-prompt-label">Как можно сформулировать точнее?</div>
          <p className="ex-prompt-hint">Не «всё хорошо». А: что из мысли правда, что преувеличено, и что ты на самом деле сейчас знаешь.</p>
        </div></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 28, padding: '18px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
          <div><div className="eyebrow" style={{ color: 'var(--c-rose)', marginBottom: 8 }}>За · {forList.length}</div>{forList.slice(0, 3).map((f, i) => <div key={i} style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5, padding: '4px 0' }}>· {f}</div>)}</div>
          <div><div className="eyebrow" style={{ color: 'var(--c-moss)', marginBottom: 8 }}>Против · {againstList.length}</div>{againstList.slice(0, 3).map((a, i) => <div key={i} style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5, padding: '4px 0' }}>· {a}</div>)}</div>
        </div>
        <textarea className="paper-area" value={reframe} onChange={e => setReframe(e.target.value)} placeholder="Иногда я действительно ошибаюсь, но это не значит что я всегда всё порчу…" rows={6} autoFocus />
        <div className="ex-foot"><button className="ex-btn ex-btn-ghost" onClick={() => setStep(2)}><GlyphArrowLeft /> Назад</button><span className="spacer" /><button className="ex-btn ex-btn-primary" disabled={!reframe.trim()} onClick={saveAll}>Сохранить и закрыть <GlyphCheck /></button></div>
      </>)}
    </ExScreen>
  );
}

function EviList({ items, onRemove, input, onInput, onAdd, placeholder }: {
  items: string[]; onRemove: (i: number) => void;
  input: string; onInput: (v: string) => void; onAdd: () => void; placeholder: string;
}) {
  return (
    <div className="evi-list">
      {items.map((f, i) => (
        <div key={i} className="evi-row">
          <span className="evi-num">{String(i + 1).padStart(2, '0')}</span>
          <span className="evi-text">{f}</span>
          <button className="evi-x" onClick={() => onRemove(i)}><GlyphX /></button>
        </div>
      ))}
      <div className="evi-add">
        <span className="evi-add-plus"><GlyphPlus /></span>
        <input className="evi-add-input" value={input} onChange={e => onInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && onAdd()} placeholder={placeholder} />
        <button className={'evi-add-go ' + (input.trim() ? 'ready' : '')} onClick={onAdd}>⏎ добавить</button>
      </div>
    </div>
  );
}
