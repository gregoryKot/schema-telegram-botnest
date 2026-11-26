import { useState } from 'react';
import '../../styles/sheet-modemap.css';
import type { ModeMapEdge, EdgeType } from '../../api';
import { EditorHead, SegRow, Swatches } from './EditorParts';
import { MODE_MAP_NODE_TEXT_MAX } from '../../../../shared/src/limits/textLimits';
import { EDGE_TYPE_LABELS, EDGE_TYPE_MARK, EDGE_TYPE_STYLE, pickPhrases } from './edgeTypes';

// Панель редактирования связи карты режимов (вынесено из ModeMapNodeEditor.tsx, правило №10); типы и подписи — edgeTypes.ts.

interface EdgeEditorProps {
  edge: ModeMapEdge;
  onChange: (updated: ModeMapEdge) => void;
  onDelete: () => void;
  onSwap: () => void;
  onClose: () => void;
}

export function ModeMapEdgeEditor({ edge, onChange, onDelete, onSwap, onClose }: EdgeEditorProps) {
  const edgeType = (edge.data?.edgeType ?? ({ '✗': 'blocks', '✓': 'meets' } as Record<string, string>)[edge.label ?? ''] ?? 'activates') as string; // ✗/✓ старых схем случая — без типа
  const bidir = edge.data?.bidirectional ?? false;
  // Suggestion box for the current type's phrases (refreshable)
  const [suggestType, setSuggestType] = useState(edgeType);
  const [suggestions, setSuggestions] = useState<string[]>(() => pickPhrases(edgeType, 4));

  const chooseType = (k: string) => {
    const phrase = pickPhrases(k, 1)[0] ?? '';
    setSuggestType(k);
    setSuggestions(pickPhrases(k, 4));
    onChange({ ...edge, label: phrase || undefined, data: { ...edge.data, ...EDGE_TYPE_STYLE[k as EdgeType], edgeType: k as EdgeType } });
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
            <span aria-hidden="true">{EDGE_TYPE_MARK[k as EdgeType] ?? '→'} </span>{v}
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
      <input id="mm-edge-label" className="ds-input" maxLength={MODE_MAP_NODE_TEXT_MAX}
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
