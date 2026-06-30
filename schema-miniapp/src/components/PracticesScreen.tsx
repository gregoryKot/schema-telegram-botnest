import { useState, useEffect } from 'react';
import { api, UserPractice } from '../api';
import { Loader } from './Loader';
import { useSafeTop } from '../utils/safezone';
import { COLORS } from '../types';
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
  const safeTop = useSafeTop();
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', overflowY: 'auto', paddingTop: safeTop }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px 8px' }}>
        <span onClick={onClose} style={{ fontSize: 26, color: 'var(--text-sub)', cursor: 'pointer', lineHeight: 1 }}>‹</span>
        <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', flex: 1 }}>Мои практики</span>
        {errorToast
          ? <span style={{ fontSize: 12, color: 'var(--accent-red)', fontWeight: 600, opacity: 1, transition: 'opacity 0.3s ease' }}>Ошибка сохранения</span>
          : <span style={{ fontSize: 12, color: 'var(--accent-green)', fontWeight: 600, opacity: addedToast ? 1 : 0, transition: 'opacity 0.3s ease' }}>Добавлено ✓</span>
        }
      </div>

      {/* Context banner */}
      <div style={{ padding: '4px 16px 0', marginBottom: 4 }}>
        <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.55 }}>
          Практики — конкретные действия, которые наполняют потребность.
          {onOpenTracker && (
            <> Видишь что что-то просело?{' '}
              <span onClick={onOpenTracker} style={{ color: 'var(--accent)', cursor: 'pointer' }}>Открой трекер →</span>
            </>
          )}
        </div>
      </div>

      <div style={{ padding: '12px 16px 140px' }}>
        {/* Need tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
          {NEED_IDS.map((id, i) => {
            const color = COLORS[id] ?? '#888';
            const emoji = NEED_DATA[id]?.emoji ?? '';
            const active = i === needIdx;
            const score = ratings[id];
            return (
              <div key={id} onClick={() => { setNeedIdx(i); setInput(''); }}
                style={{ flexShrink: 0, padding: '7px 12px', borderRadius: 20, background: active ? color + '28' : 'rgba(var(--fg-rgb),0.05)', border: `1px solid ${active ? color + '55' : 'transparent'}`, color: active ? color : 'rgba(var(--fg-rgb),0.45)', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: active ? 600 : 400, display: 'flex', alignItems: 'center', gap: 5 }}>
                {emoji} {NEED_NAMES[id]}
                {score !== undefined && (
                  <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.7, color: score <= 4 ? 'var(--accent-red)' : score <= 7 ? 'var(--accent-yellow)' : 'var(--accent-green)' }}>
                    {score}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Contextual card when need is low */}
        {isLow && (
          <div style={{ background: `${needColor}12`, border: `1px solid ${needColor}25`, borderRadius: 14, padding: '11px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>📍</span>
            <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.5 }}>
              Сегодня <span style={{ color: needColor, fontWeight: 600 }}>{NEED_NAMES[needId]}</span> на {todayScore}/10 — хороший момент чтобы что-то сделать для этой потребности.
            </div>
          </div>
        )}
        {isMid && (
          <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 14, padding: '11px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>💛</span>
            <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.5 }}>
              Сегодня {NEED_NAMES[needId]} — {todayScore}/10. Есть куда расти.
            </div>
          </div>
        )}

        {/* Practices list */}
        {!practices ? (
          <Loader minHeight="20vh" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {practices.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--text-sub)', padding: '20px 0', textAlign: 'center' }}>
                Пока пусто — добавь первую практику ниже
              </div>
            )}
            {practices.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(var(--fg-rgb),0.04)', borderRadius: 14, padding: '13px 14px' }}>
                <div style={{ fontSize: 14, color: 'rgba(var(--fg-rgb),0.85)', flex: 1, lineHeight: 1.5 }}>{p.text}</div>
                <div onClick={() => handleDelete(p.id as number)}
                  style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: 'rgba(255,100,100,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, color: 'rgba(255,100,100,0.5)' }}>×</div>
              </div>
            ))}
          </div>
        )}

        {/* Add input */}
        <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.6 }}>
          Небольшое конкретное действие — например «позвонить другу» или «прогулка 20 минут»
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="Добавить практику..."
            maxLength={200}
            style={{ flex: 1, background: 'rgba(var(--fg-rgb),0.05)', border: '1px solid rgba(var(--fg-rgb),0.1)', borderRadius: 12, padding: '12px 14px', color: 'var(--text)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
          />
          <button
            onClick={handleAdd}
            disabled={!input.trim() || saving}
            style={{ padding: '12px 18px', borderRadius: 12, border: 'none', background: input.trim() ? needColor : 'rgba(var(--fg-rgb),0.07)', color: 'var(--text)', fontSize: 16, fontWeight: 600, cursor: input.trim() ? 'pointer' : 'default', flexShrink: 0 }}
          >+</button>
        </div>
      </div>
    </div>
  );
}
