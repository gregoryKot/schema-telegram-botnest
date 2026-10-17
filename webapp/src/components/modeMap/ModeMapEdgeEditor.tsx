import { useState } from 'react';
import '../../styles/sheet-modemap.css';
import type { ModeMapEdge, EdgeType } from '../../api';
import { EditorHead, SegRow, Swatches } from './EditorParts';

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

  const lineOpts = [
    { k: 'solid'  as const, label: 'Сплошная', dash: 'none' },
    { k: 'dashed' as const, label: 'Пунктир',  dash: '6 4' },
    { k: 'dotted' as const, label: 'Точки',    dash: '1.5 4' },
  ];
  const widthOpts = [
    { v: 'thin' as const,   label: 'Тонкая', h: 2 },
    { v: 'normal' as const, label: 'Обычная', h: 3 },
    { v: 'bold' as const,   label: 'Жирная', h: 4.5 },
  ];
  const patchData = (d: Partial<NonNullable<ModeMapEdge['data']>>) => onChange({ ...edge, data: { ...edge.data, ...d } });

  return (
    <div className="ds-card mm2-panel">
      <EditorHead title="Связь" onClose={onClose} />

      <div className="ds-label">Тип связи (вставит подпись)</div>
      <div className="mm2-chips">
        {Object.entries(EDGE_TYPE_LABELS).map(([k, v]) => (
          <button key={k} onClick={() => chooseType(k)} className={`mm2-chip${edgeType === k ? ' is-active' : ''}`}>
            <span aria-hidden="true">→ </span>{v}
          </button>
        ))}
      </div>

      {/* Suggestion box — pick a phrase for the line or refresh for more */}
      <div className="mm2-sugg">
        <div className="mm2-sugg-head">
          <span className="ds-label">Варианты подписи</span>
          <button onClick={() => setSuggestions(pickPhrases(suggestType, 4))} title="Другие варианты" aria-label="Другие варианты">↻</button>
        </div>
        <div className="mm2-chips is-tight">
          {suggestions.map(p => (
            <button key={p} onClick={() => onChange({ ...edge, label: p })}
              className={`mm2-chip is-sm${edge.label === p ? ' is-active' : ''}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      <label className="ds-label" htmlFor="mm-edge-label">Подпись (необязательно)</label>
      <input id="mm-edge-label" className="ds-input"
        value={edge.label ?? ''}
        onChange={e => onChange({ ...edge, label: e.target.value || undefined })}
        placeholder="Текст на стрелке" />

      <div className="ds-label">Стиль линии</div>
      <SegRow items={lineOpts.map(opt => {
        const active = (edge.data?.lineStyle ?? 'solid') === opt.k;
        return {
          key: opt.k, label: opt.label, hint: opt.label, active, onPick: () => patchData({ lineStyle: opt.k }),
          lead: (
            <svg width={36} height={6} viewBox="0 0 36 6">
              <line x1={1} y1={3} x2={35} y2={3} stroke="currentColor"
                strokeWidth={2} strokeDasharray={opt.dash === 'none' ? undefined : opt.dash} strokeLinecap="round" />
            </svg>
          ),
        };
      })} />

      <div className="ds-label">Толщина линии</div>
      <SegRow items={widthOpts.map(opt => ({
        key: opt.v, label: opt.label, hint: opt.label, active: (edge.data?.width ?? 'normal') === opt.v,
        onPick: () => patchData({ width: opt.v }), lead: <i style={{ height: opt.h }} />,
      }))} />

      <div className="ds-label">Направление</div>
      <SegRow items={[
        { key: 'one', label: 'одна', hint: 'Одна стрелка', active: !bidir, lead: <span className="mm2-arrow">→</span>, onPick: () => patchData({ bidirectional: false }) },
        { key: 'both', label: 'обе', hint: 'Две стрелки', active: bidir, lead: <span className="mm2-arrow">↔</span>, onPick: () => patchData({ bidirectional: true }) },
        { key: 'swap', label: 'развернуть', hint: 'Развернуть (поменять начало и конец)', active: false, lead: <span className="mm2-arrow">⤺</span>, onPick: onSwap },
      ]} />

      <div className="ds-label">Цвет стрелки</div>
      <Swatches colors={['var(--c-rose)','var(--c-moss)','var(--c-clay)','var(--c-teal)','var(--c-plum)','var(--c-slate)']}
        current={edge.data?.color} onPick={c => patchData({ color: c })}
        onReset={() => patchData({ color: undefined })} resetLabel="Нейтральный (по умолчанию)" />

      <button onClick={onDelete} className="ds-btn ds-btn--secondary mm2-del">Удалить связь</button>
    </div>
  );
}
