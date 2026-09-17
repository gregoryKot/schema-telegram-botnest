import { useState } from 'react';
import type { ModeMapEdge, EdgeType } from '../../api';
import { MMIcon } from '../modeMapIcons';
import {
  panelStyle, labelStyle, inputStyle, deleteBtnStyle, closeBtnStyle,
  colorPresetLabel,
} from './editorStyles';

// Панель редактирования связи карты режимов.
// Вынесено из ModeMapNodeEditor.tsx (правило №10).

const EDGE_TYPE_LABELS: Record<string, string> = {
  activates:  'активирует',
  protects:   'защищает от',
  suppresses: 'подавляет',
  leads_to:   'ведёт к',
};

// Suggested phrases per connection type — clicking a type drops a random one on the
// line, and the «окошко» below lets you pick another or type your own.
const EDGE_TYPE_PHRASES: Record<string, string[]> = {
  activates:  ['активирует', 'запускает', 'будит', 'включает', 'провоцирует', 'пробуждает', 'цепляет', 'триггерит'],
  protects:   ['защищает от', 'прикрывает', 'оберегает от', 'спасает от', 'отгораживает от', 'прячет'],
  suppresses: ['подавляет', 'давит на', 'заглушает', 'наказывает', 'обесценивает', 'критикует', 'стыдит', 'требует от'],
  leads_to:   ['ведёт к', 'приводит к', 'оборачивается', 'заканчивается', 'усиливает', 'подкрепляет'],
};

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function pickPhrases(type: string, n: number): string[] {
  return shuffle(EDGE_TYPE_PHRASES[type] ?? []).slice(0, n);
}

interface EdgeEditorProps {
  edge: ModeMapEdge;
  onChange: (updated: ModeMapEdge) => void;
  onDelete: () => void;
  onSwap: () => void;
  onClose: () => void;
}

export function ModeMapEdgeEditor({ edge, onChange, onDelete, onSwap, onClose }: EdgeEditorProps) {
  const edgeType = (edge.data?.edgeType ?? 'activates') as string;
  const bidir = edge.data?.bidirectional ?? false;
  // Suggestion box for the current type's phrases (refreshable)
  const [suggestType, setSuggestType] = useState(edgeType);
  const [suggestions, setSuggestions] = useState<string[]>(() => pickPhrases(edgeType, 4));

  const chooseType = (k: string) => {
    const phrase = pickPhrases(k, 1)[0] ?? '';
    setSuggestType(k);
    setSuggestions(pickPhrases(k, 4));
    onChange({ ...edge, label: phrase || undefined, data: { ...edge.data, edgeType: k as EdgeType } });
  };

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>Связь</div>
        <button onClick={onClose} title="Закрыть" aria-label="Закрыть" style={closeBtnStyle}><MMIcon name="close" size={15} /></button>
      </div>

      <div style={labelStyle}>Тип связи (вставит подпись)</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {Object.entries(EDGE_TYPE_LABELS).map(([k, v]) => (
          <button key={k}
            onClick={() => chooseType(k)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 'var(--r-14)', textAlign: 'left', fontSize: 12, cursor: 'pointer',
              border: `1px solid ${edgeType === k ? 'var(--accent)' : 'var(--line-strong)'}`,
              background: edgeType === k ? 'var(--accent-soft)' : 'none',
              color: edgeType === k ? 'var(--accent)' : 'var(--text-sub)' }}>
            <span style={{ fontSize: 11, opacity: 0.7 }}>→</span>
            {v}
          </button>
        ))}
      </div>

      {/* Suggestion box — pick a phrase for the line or refresh for more */}
      <div style={{ marginBottom: 14, padding: '8px 9px', borderRadius: 'var(--r-8)',
        border: '1px solid var(--line)', background: 'var(--surface-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 7 }}>
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-faint)', flex: 1 }}>
            Варианты подписи
          </span>
          <button onClick={() => setSuggestions(pickPhrases(suggestType, 4))} title="Другие варианты" aria-label="Другие варианты"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 13, padding: 0, lineHeight: 1 }}>↻</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {suggestions.map(p => {
            const active = edge.label === p;
            return (
              <button key={p} onClick={() => onChange({ ...edge, label: p })}
                style={{ padding: '4px 9px', borderRadius: 'var(--r-14)', fontSize: 11.5, cursor: 'pointer',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--line-strong)'}`,
                  background: active ? 'var(--accent-soft)' : 'var(--bg-elev)',
                  color: active ? 'var(--accent)' : 'var(--text-sub)' }}>
                {p}
              </button>
            );
          })}
        </div>
      </div>

      <label style={labelStyle} htmlFor="mm-edge-label">Подпись (необязательно)</label>
      <input id="mm-edge-label" style={inputStyle}
        value={edge.label ?? ''}
        onChange={e => onChange({ ...edge, label: e.target.value || undefined })}
        placeholder="Текст на стрелке" />

      <div style={labelStyle}>Стиль линии</div>
      <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
        {([
          { k: 'solid'  as const, label: 'Сплошная', dash: 'none' },
          { k: 'dashed' as const, label: 'Пунктир',  dash: '6 4' },
          { k: 'dotted' as const, label: 'Точки',    dash: '1.5 4' },
        ]).map(opt => {
          const active = (edge.data?.lineStyle ?? 'solid') === opt.k;
          return (
            <button key={opt.k} onClick={() => onChange({ ...edge, data: { ...edge.data, lineStyle: opt.k } })}
              title={opt.label} aria-label={opt.label}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)',
                padding: '7px 4px', borderRadius: 'var(--r-6)', cursor: 'pointer',
                border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line-strong)'}`,
                background: active ? 'var(--accent-soft)' : 'none' }}>
              <svg width={36} height={6} viewBox="0 0 36 6">
                <line x1={1} y1={3} x2={35} y2={3} stroke={active ? 'var(--accent)' : 'var(--text-sub)'}
                  strokeWidth={2} strokeDasharray={opt.dash === 'none' ? undefined : opt.dash} strokeLinecap="round" />
              </svg>
              <span style={{ fontSize: 9, color: active ? 'var(--accent)' : 'var(--text-faint)' }}>{opt.label}</span>
            </button>
          );
        })}
      </div>

      <div style={labelStyle}>Толщина линии</div>
      <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
        {([
          { v: 'thin' as const,   label: 'Тонкая', h: 2 },
          { v: 'normal' as const, label: 'Обычная', h: 3 },
          { v: 'bold' as const,   label: 'Жирная', h: 4.5 },
        ]).map(opt => {
          const active = (edge.data?.width ?? 'normal') === opt.v;
          return (
            <button key={opt.v} onClick={() => onChange({ ...edge, data: { ...edge.data, width: opt.v } })} title={opt.label} aria-label={opt.label}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                padding: '8px 4px', borderRadius: 'var(--r-6)', cursor: 'pointer',
                border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line-strong)'}`,
                background: active ? 'var(--accent-soft)' : 'none' }}>
              <span style={{ width: 28, height: opt.h, borderRadius: opt.h, background: active ? 'var(--accent)' : 'var(--text-sub)' }} />
              <span style={{ fontSize: 9, color: active ? 'var(--accent)' : 'var(--text-faint)' }}>{opt.label}</span>
            </button>
          );
        })}
      </div>

      <div style={labelStyle}>Направление</div>
      <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
        {/* One-way (current direction) */}
        <button onClick={() => onChange({ ...edge, data: { ...edge.data, bidirectional: false } })}
          title="Одна стрелка" aria-label="Одна стрелка"
          style={dirBtnStyle(!bidir)}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>→</span>
          <span style={{ fontSize: 9 }}>одна</span>
        </button>
        {/* Both ways */}
        <button onClick={() => onChange({ ...edge, data: { ...edge.data, bidirectional: true } })}
          title="Две стрелки" aria-label="Две стрелки"
          style={dirBtnStyle(bidir)}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>↔</span>
          <span style={{ fontSize: 9 }}>обе</span>
        </button>
        {/* Reverse — swaps source/target */}
        <button onClick={onSwap} title="Развернуть (поменять начало и конец)" aria-label="Развернуть (поменять начало и конец)"
          style={dirBtnStyle(false)}>
          <span style={{ fontSize: 15, lineHeight: 1 }}>⤺</span>
          <span style={{ fontSize: 9 }}>развернуть</span>
        </button>
      </div>

      <div style={labelStyle}>Цвет стрелки</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {['var(--c-rose)','var(--c-moss)','var(--c-clay)','var(--c-teal)','var(--c-plum)','var(--c-slate)'].map(c => (
          <button key={c} onClick={() => onChange({ ...edge, data: { ...edge.data, color: c } })}
            aria-label={colorPresetLabel(c)} title={colorPresetLabel(c)}
            style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', padding: 0,
              border: edge.data?.color === c ? '2px solid var(--text)' : '2px solid transparent' }} />
        ))}
        <button onClick={() => onChange({ ...edge, data: { ...edge.data, color: undefined } })} title="Нейтральный (по умолчанию)" aria-label="Нейтральный (по умолчанию)"
          style={{ width: 22, height: 22, borderRadius: '50%', background: 'none', cursor: 'pointer', padding: 0,
            border: '2px dashed var(--line-strong)', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MMIcon name="close" size={11} /></button>
      </div>

      <button onClick={onDelete} style={deleteBtnStyle}>Удалить связь</button>
    </div>
  );
}

function dirBtnStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 2, padding: '6px 4px', borderRadius: 'var(--r-6)', cursor: 'pointer',
    border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line-strong)'}`,
    background: active ? 'var(--accent-soft)' : 'none',
    color: active ? 'var(--accent)' : 'var(--text-sub)',
  };
}
