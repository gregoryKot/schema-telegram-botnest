import { useState, useEffect } from 'react';
import { api } from '../../api';
import { ExScreen, GlyphCheck } from './ExScreen';
import { useHistorySheet } from '../../hooks/useHistorySheet';

function fmtAgo(d: string): string {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return 'сегодня';
  if (days === 1) return 'вчера';
  if (days < 7) return `${days} дн. назад`;
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function LetterEx({ onBack, onComplete }: { onBack: () => void; onComplete?: () => void }) {
  const goBack = useHistorySheet(onBack);
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);
  const [pastLetters, setPastLetters] = useState<any[]>([]);

  useEffect(() => {
    if (done) api.getLetters().then(l => setPastLetters(l.slice(0, 3))).catch(() => {});
  }, [done]);

  async function seal() {
    try { await api.createLetter(text); } catch {}
    onComplete?.();
    setDone(true);
  }

  if (done) {
    const others = pastLetters.filter(l => l.text !== text);
    return (
      <ExScreen onBack={goBack} eyebrow="Письмо · сохранено" eyebrowColor="var(--c-moss)"
        title={<>Письмо<br/><span className="it">написано.</span></>}
        lede="Иногда – самая важная работа. Вернись к нему через неделю и перечитай вслух."
        aside={others.length > 0 ? (
          <div className="aside-card">
            <div className="aside-card-eyebrow">Прошлые письма · {pastLetters.length}</div>
            {others.slice(0, 2).map((l, i) => (
              <div key={i} className="history-row">
                <span className="history-date">{fmtAgo(l.createdAt)}</span>
                <span className="history-snippet">«{l.text.slice(0, 120)}…»</span>
              </div>
            ))}
          </div>
        ) : undefined}
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
          <button className="ex-btn ex-btn-primary" onClick={goBack}>Закрыть</button>
        </div>
      </ExScreen>
    );
  }

  return (
    <ExScreen onBack={goBack} eyebrow="№ 04 · Эмоциональная работа" eyebrowColor="var(--c-amber)"
      title={<>Письмо<br/><span className="it">уязвимому ребёнку</span></>}
      lede="Сядь рядом с собой-маленьким – таким, каким ты был, когда было трудно. Скажи ему то, что он должен был услышать тогда."
      aside={<>
        <div className="aside-card" style={{ borderColor: 'var(--c-amber)40', background: 'var(--c-amber)08' }}>
          <div className="aside-card-eyebrow" style={{ color: 'var(--c-amber)' }}>С чего начать</div>
          <h3>Три вопроса перед тем как писать</h3>
          <ul style={{ marginTop: 14 }}>
            <li>Какой момент из детства – самый трудный?</li>
            <li>Что ты тогда чувствовал? Чего не хватало?</li>
            <li>Что он должен был услышать – но не услышал?</li>
          </ul>
        </div>
        <div className="aside-card">
          <div className="aside-card-eyebrow">Подсказка</div>
          <p className="body">Не редактируй. Пиши от руки сердца, не от головы. Если становится слишком – остановись и просто посиди.</p>
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
