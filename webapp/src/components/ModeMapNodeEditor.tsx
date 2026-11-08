import { useEffect, useRef } from 'react';
import type { ModeMapNode } from '../api';
import { TYPE_COLORS } from './modeMapData';
import '../styles/sheet-modemap.css';
import { ClinicalHint } from './modeMap/ClinicalHint';
import { ShapePreview } from './modeMap/ShapePreview';
import { SHAPE_OPTIONS, type ShapeOption } from './modeMap/shapeOptions';
import { nodeTexts } from './modeMap/nodeTexts';
import { COLOR_PRESETS } from './modeMap/editorStyles';
import { EditorHead, SegRow, Swatches } from './modeMap/EditorParts';
import { MODE_MAP_NODE_TEXT_MAX } from '../../../shared/src/limits/textLimits';
import { NodeIdentityField, NodeMeaningFields, type HubFill } from './modeMap/NodeMeaningFields';

// Панель редактирования связи жила в этом же файле — вынесена (правило №10);
// ре-экспорт сохраняет прежний путь импорта у консьюмеров.
export { ModeMapEdgeEditor } from './modeMap/ModeMapEdgeEditor';

interface NodeEditorProps {
  node: ModeMapNode;
  onChange: (updated: ModeMapNode) => void;
  onDelete: () => void;
  onClose: () => void;
  coupleMode?: boolean;   // карта пары → показать выбор партнёра
  hub?: HubFill;          // круг потребностей: достроить недостающие потребности
}

export function ModeMapNodeEditor({ node, onChange, onDelete, onClose, coupleMode, hub }: NodeEditorProps) {
  const nameRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const needRef = useRef<HTMLInputElement>(null);
  const healthyRef = useRef<HTMLTextAreaElement>(null);

  const patchData = (d: Partial<ModeMapNode['data']>) =>
    onChange({ ...node, data: { ...node.data, ...d } });
  const patchShape = (opt: ShapeOption) =>
    onChange({ ...node, type: opt.type, data: { ...node.data, copingSubtype: opt.copingSubtype } });
  const texts = nodeTexts(node.type);
  const currentColor = node.data.customColor ?? TYPE_COLORS[node.type] ?? TYPE_COLORS.custom;

  // Double-click on a node → focus the name field for quick rename
  useEffect(() => {
    const h = () => { nameRef.current?.focus(); nameRef.current?.select(); };
    window.addEventListener('modemap-focus-name', h);
    return () => window.removeEventListener('modemap-focus-name', h);
  }, []);

  // Guide step «Потребность» → focus the unmet-need field
  useEffect(() => {
    const h = () => { needRef.current?.focus(); needRef.current?.scrollIntoView({ block: 'center' }); };
    window.addEventListener('modemap-focus-need', h);
    return () => window.removeEventListener('modemap-focus-need', h);
  }, []);

  const fillOpts = [
    { label: 'Лёгкая', filled: false, fillFull: false },
    { label: 'Средняя', filled: true,  fillFull: false },
    { label: 'Полная',  filled: false, fillFull: true  },
  ];
  const strokeOpts = [
    { v: 'thin' as const,   label: 'Тонкий', h: 1.5 },
    { v: 'normal' as const, label: 'Обычный', h: 2.5 },
    { v: 'bold' as const,   label: 'Жирный', h: 4 },
  ];
  const fontOpts = [{ v: 'sm' as const, fs: 11 }, { v: 'md' as const, fs: 14 }, { v: 'lg' as const, fs: 18 }];
  const displayOpts = [
    { v: 'name' as const, label: 'Имя' },
    { v: 'note' as const, label: '+ Заметка' },
    { v: 'full' as const, label: 'Всё' },
  ];

  return (
    <div className="ds-card mm2-panel">
      <EditorHead title={texts.title} onClose={onClose} />

      <label className="ds-label" htmlFor="mm-node-name">Название</label>
      <input id="mm-node-name" ref={nameRef} className="ds-input" value={node.data.label} maxLength={MODE_MAP_NODE_TEXT_MAX}
        onChange={e => patchData({ label: e.target.value })} placeholder="Подпись на фигуре" />

      {coupleMode && (
        <>
          <div className="ds-label">Чей режим</div>
          <div className="mm2-partners">
            {([
              { v: 'A' as const, label: 'Партнёр А', color: 'var(--accent-blue)' },
              { v: 'B' as const, label: 'Партнёр Б', color: 'var(--accent-orange)' },
            ]).map(opt => {
              const active = node.data.side === opt.v;
              return (
                <button key={opt.v} onClick={() => patchData({ side: active ? undefined : opt.v })}
                  className={`mm2-partner${active ? ' is-active' : ''}`} style={{ '--pc': opt.color } as React.CSSProperties}>
                  <i />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      <NodeIdentityField node={node} patchData={patchData} hub={hub} />

      <ClinicalHint node={node}
        onPickNote={() => { noteRef.current?.focus(); }}
        onPickNeed={() => { needRef.current?.focus(); }}
        onPickHealthy={() => { healthyRef.current?.focus(); healthyRef.current?.scrollIntoView({ block: 'nearest' }); }} />

      <label className="ds-label" htmlFor="mm-node-note">{texts.note}</label>
      <textarea id="mm-node-note" ref={noteRef} className="ds-textarea" style={{ minHeight: 56 }} rows={3} maxLength={MODE_MAP_NODE_TEXT_MAX}
        value={node.data.note ?? ''} onChange={e => patchData({ note: e.target.value || undefined })}
        placeholder={texts.notePlaceholder} />
      {texts.hint && <div className="ds-sub mm2-field-hint">{texts.hint}</div>}

      <NodeMeaningFields node={node} patchData={patchData} needRef={needRef} healthyRef={healthyRef} />

      {/* Сначала смысл фигуры, потом оформление: клинические поля стояли под шестью переключателями стиля (аудит 2026-11). */}
      <div className="ds-label mm2-panel-sec">Оформление</div>
      {node.type !== 'needs' && <div className="ds-label">Форма и тип</div>}
      {node.type !== 'needs' && <div className="mm2-shape-grid">
        {SHAPE_OPTIONS.map((opt, i) => {
          const isActive = node.type === opt.type &&
            (node.type === 'coping' ? node.data.copingSubtype === opt.copingSubtype : true);
          return (
            <button key={i} onClick={() => patchShape(opt)} title={opt.full ?? opt.label}
              className={`mm2-pick${isActive ? ' is-active' : ''}`}>
              <ShapePreview opt={opt} active={isActive} />
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>}

      <div className="ds-label">Цвет</div>
      <Swatches colors={COLOR_PRESETS} current={currentColor} onPick={c => patchData({ customColor: c })}
        onReset={() => patchData({ customColor: undefined })} resetLabel="Сбросить" />

      <div className="ds-label">Заливка</div>
      <SegRow items={fillOpts.map(opt => ({
        key: opt.label, label: opt.label,
        active: !!node.data.fillFull === opt.fillFull && !!node.data.filled === opt.filled,
        onPick: () => patchData({ filled: opt.filled, fillFull: opt.fillFull }),
      }))} />

      <div className="ds-label">Толщина контура</div>
      <SegRow items={strokeOpts.map(opt => ({
        key: opt.v, label: opt.label, hint: opt.label, active: (node.data.strokeWidth ?? 'normal') === opt.v,
        onPick: () => patchData({ strokeWidth: opt.v }),
        lead: <i style={{ height: opt.h }} />,
      }))} />

      <div className="ds-label">Размер текста</div>
      <SegRow items={fontOpts.map(opt => ({
        key: opt.v, label: 'A', active: (node.data.fontSize ?? 'md') === opt.v, style: { fontSize: opt.fs, lineHeight: 1.2 },
        onPick: () => patchData({ fontSize: opt.v }),
      }))} />

      <div className="ds-label">Что показывать на фигуре</div>
      <SegRow items={displayOpts.map(opt => ({
        key: opt.v, label: opt.label, active: (node.data.display ?? 'full') === opt.v,
        onPick: () => patchData({ display: opt.v }),
      }))} />

      <button onClick={onDelete} className="ds-btn ds-btn--secondary mm2-del">Удалить фигуру</button>
    </div>
  );
}
