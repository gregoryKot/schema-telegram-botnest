import { useState } from 'react';
import { api } from '../../api';
import { ExScreen, GlyphCheck } from './ExScreen';

export function LetterEx({ onBack }: { onBack: () => void }) {
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);

  async function seal() {
    try { await api.createLetter(text); } catch {}
    setDone(true);
  }

  if (done) {
    return (
      <ExScreen onBack={onBack} eyebrow="Письмо · сохранено" eyebrowColor="var(--c-moss)"
        title={<>Письмо<br/><span className="it">написано.</span></>}
        lede="Иногда — самая важная работа. Вернись к нему через неделю и перечитай вслух."
      >
        <div className="letter-paper">
          <div className="letter-salutation">Дорогой маленький я,</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 19, lineHeight: '32px', color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{text}</div>
          <div className="letter-meta">
            <span>{new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            <span>{text.split(/\s+/).filter(Boolean).length} слов</span>
          </div>
        </div>
        <div className="ex-foot">
          <button className="ex-btn ex-btn-outline" onClick={() => setDone(false)}>Изменить</button>
          <span className="spacer" />
          <button className="ex-btn ex-btn-primary" onClick={onBack}>Закрыть</button>
        </div>
      </ExScreen>
    );
  }

  return (
    <ExScreen onBack={onBack} eyebrow="№ 04 · Эмоциональная работа" eyebrowColor="var(--c-amber)"
      title={<>Письмо<br/><span className="it">уязвимому ребёнку</span></>}
      lede="Сядь рядом с собой-маленьким — таким, каким ты был, когда было трудно. Скажи ему то, что он должен был услышать тогда."
      aside={<>
        <div className="aside-card" style={{ borderColor: 'var(--c-amber)40', background: 'var(--c-amber)08' }}>
          <div className="aside-card-eyebrow" style={{ color: 'var(--c-amber)' }}>С чего начать</div>
          <h3>Три вопроса перед тем как писать</h3>
          <ul style={{ marginTop: 14 }}>
            <li>Какой момент из детства — самый трудный?</li>
            <li>Что ты тогда чувствовал? Чего не хватало?</li>
            <li>Что он должен был услышать — но не услышал?</li>
          </ul>
        </div>
        <div className="aside-card">
          <div className="aside-card-eyebrow">Подсказка</div>
          <p className="body">Не редактируй. Пиши от руки сердца, не от головы. Если становится слишком — остановись и просто посиди.</p>
        </div>
      </>}
    >
      <div className="letter-paper">
        <div className="letter-salutation">Дорогой маленький я,</div>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="…" autoFocus />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-faint)', marginTop: 12, marginBottom: 24 }}>
        <span>Сохраняется в дневнике</span>
        <span>{text.split(/\s+/).filter(Boolean).length} слов</span>
      </div>
      <div className="ex-foot">
        <span className="spacer" />
        <button className="ex-btn ex-btn-primary" disabled={!text.trim()} onClick={seal}>Запечатать письмо <GlyphCheck /></button>
      </div>
    </ExScreen>
  );
}
