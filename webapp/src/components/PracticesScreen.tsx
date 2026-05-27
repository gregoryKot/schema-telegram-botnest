import { useState, useEffect } from 'react';
import { api } from '../api';
import type { UserPractice } from '../api';
import { Loader } from './Loader';
import { COLORS } from '../types';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { NEED_DATA } from '../needData';

const NEED_IDS = ['attachment', 'autonomy', 'expression', 'play', 'limits'];
const NEED_NAMES: Record<string, string> = {
  attachment: 'Привязанность', autonomy: 'Автономия',
  expression: 'Выражение чувств', play: 'Спонтанность', limits: 'Границы',
};

interface Props {
  onClose: () => void;
  onOpenTracker?: () => void;
}

export function PracticesScreen({ onClose, onOpenTracker }: Props) {
  const goBack = useHistorySheet(onClose);
  const [needIdx, setNeedIdx] = useState(0);
  const [practices, setPractices] = useState<UserPractice[] | null>(null);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [addedToast, setAddedToast] = useState(false);
  const [errorToast, setErrorToast] = useState(false);
  const [ratings, setRatings] = useState<Record<string, number>>({});

  useEffect(() => {
    api.ratings().then(setRatings).catch(() => {});
  }, []);

  useEffect(() => {
    setPractices(null);
    api.getPractices(NEED_IDS[needIdx]).then(setPractices).catch(() => setPractices([]));
  }, [needIdx]);

  async function handleAdd() {
    const text = input.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      await api.addPractice(NEED_IDS[needIdx], text);
      setInput('');
      setAddedToast(true);
      setTimeout(() => setAddedToast(false), 2000);
      api.getPractices(NEED_IDS[needIdx]).then(setPractices).catch(() => {});
    } catch {
      setErrorToast(true);
      setTimeout(() => setErrorToast(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(id: number) {
    setPractices(prev => prev?.filter(x => x.id !== id) ?? null);
    api.deletePractice(id).catch(() => {});
  }

  const needId = NEED_IDS[needIdx];
  const needColor = COLORS[needId] ?? 'var(--accent)';
  const todayScore = ratings[needId];
  const isLow = todayScore !== undefined && todayScore <= 4;
  const isMid = todayScore !== undefined && todayScore > 4 && todayScore <= 7;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', overflowY: 'auto' }}>
      <div className="page-inner-wide" style={{ paddingTop: 40, paddingBottom: 80 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 36 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              <span style={{ color: 'var(--accent)' }}>● </span>Каталог практик
            </div>
            <h1 className="hub-title" style={{ marginBottom: 8 }}>Мои<br /><span className="it">практики</span></h1>
            <div className="text-md muted" style={{ maxWidth: 560, lineHeight: 1.6 }}>
              Конкретные действия, которые наполняют потребность.
              {onOpenTracker && <> Видишь что что-то просело? <span onClick={onOpenTracker} className="link" style={{ cursor: 'pointer' }}>Открой трекер →</span></>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {errorToast && <span className="text-sm" style={{ color: 'var(--c-rose)', fontWeight: 500 }}>Ошибка сохранения</span>}
            {addedToast && <span className="text-sm" style={{ color: 'var(--c-moss)', fontWeight: 500 }}>Добавлено</span>}
            <button onClick={goBack} className="btn btn-secondary">Закрыть</button>
          </div>
        </div>

        {/* Need tabs — calm document style */}
        <div className="tabs" style={{ marginBottom: 28 }}>
          {NEED_IDS.map((id, i) => {
            const active = i === needIdx;
            const score = ratings[id];
            return (
              <button
                key={id}
                className={`tab ${active ? 'is-active' : ''}`}
                onClick={() => { setNeedIdx(i); setInput(''); }}
              >
                {NEED_NAMES[id]}
                {score !== undefined && <span className="count" style={{ color: score <= 4 ? 'var(--c-rose)' : score <= 7 ? 'var(--c-amber)' : 'var(--c-moss)' }}>{score}</span>}
              </button>
            );
          })}
        </div>

        {/* Contextual hint */}
        {(isLow || isMid) && (
          <div className="section" style={{ paddingBottom: 8 }}>
            <div className="text-md" style={{ color: isLow ? needColor : 'var(--c-amber)', lineHeight: 1.55, maxWidth: 600 }}>
              {isLow
                ? <>Сегодня <b>{NEED_NAMES[needId]}</b> на {todayScore}/10 — хороший момент чтобы что-то сделать для этой потребности.</>
                : <>Сегодня {NEED_NAMES[needId]} — {todayScore}/10. Есть куда расти.</>}
            </div>
          </div>
        )}

        {/* Practices list */}
        <div className="section">
          <div className="section-head">
            <h3>{NEED_DATA[needId]?.name ?? NEED_NAMES[needId]}</h3>
            {practices && <span className="hint">{practices.length} {practices.length === 1 ? 'практика' : practices.length < 5 ? 'практики' : 'практик'}</span>}
          </div>
          {!practices ? (
            <Loader minHeight="20vh" />
          ) : practices.length === 0 ? (
            <div className="text-sm muted">Пока пусто — добавь первую практику ниже.</div>
          ) : (
            practices.map(p => (
              <div key={p.id} className="list-line">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="text-md" style={{ lineHeight: 1.5 }}>{p.text}</div>
                </div>
                <button
                  onClick={() => handleDelete(p.id as number)}
                  className="link"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--c-rose)' }}
                >
                  удалить
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add input */}
        <div className="section">
          <div className="eyebrow" style={{ marginBottom: 10 }}>Новая практика</div>
          <div className="text-sm muted" style={{ marginBottom: 12, maxWidth: 600 }}>
            Небольшое конкретное действие — например «позвонить другу» или «прогулка 20 минут»
          </div>
          <div style={{ display: 'flex', gap: 8, maxWidth: 600 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              placeholder="Добавить практику..."
              maxLength={200}
              className="input"
              style={{ flex: 1 }}
            />
            <button
              onClick={handleAdd}
              disabled={!input.trim() || saving}
              className={input.trim() ? 'btn btn-primary' : 'btn btn-secondary'}
            >
              {saving ? '...' : '+ Добавить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
