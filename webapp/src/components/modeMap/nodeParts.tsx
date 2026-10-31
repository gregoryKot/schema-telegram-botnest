import { useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeToolbar } from '@xyflow/react';
import { useNodeActions } from '../modeMapActions';
import { MMIcon } from '../modeMapIcons';
import { getSchemaById } from '../../schemaTherapyData';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { useTr } from '../../utils/addressForm';
import { fontPx, type ModeNodeData } from './nodeStyle';

// Общие части фигур карты режимов: тулбар выбранной ноды, бейдж партнёра, ручки
// соединения и подпись. Вынесены из ModeMapNodes.tsx (правило №10), чтобы фигуры
// схемы случая (ConceptNodes.tsx) брали те же куски, а не копии.

// Connection dots at the 4 sides. Hidden by default, revealed on node hover
// (CSS rule .react-flow__node:hover .mm-handle in index.css) so it's obvious
// you can drag from here to draw a line. connectionRadius makes the drop
// forgiving. Each side has source + target (same id) for loose mode + swap.
// Bigger hit area (18px) so it's easy to grab and start a line; the visible
// dot is drawn via the ::after pseudo in index.css. Source on top of target.
const dotStyle: React.CSSProperties = {
  width: 18, height: 18, background: 'transparent', border: 'none',
};

function SideHandles({ pos, id }: { pos: Position; id: string }) {
  return (
    <>
      <Handle type="target" position={pos} id={id} className="mm-handle" style={dotStyle} />
      <Handle type="source" position={pos} id={id} className="mm-handle" style={dotStyle} />
    </>
  );
}

// Full-node drop target — only catches pointer events while a connection is being
// drawn (.react-flow.connecting in index.css). Lets you drop a line ANYWHERE on a
// node instead of hunting for a dot. Normal dragging still works (pointer-events:none).
const coverStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, width: '100%', height: '100%',
  minWidth: 0, minHeight: 0, transform: 'none', borderRadius: 'inherit',
  background: 'transparent', border: 'none',
};

export function AllHandles() {
  return (
    <>
      <Handle type="target" position={Position.Top} id="c" className="mm-node-target" style={coverStyle} />
      <SideHandles pos={Position.Left}   id="l" />
      <SideHandles pos={Position.Right}  id="r" />
      <SideHandles pos={Position.Top}    id="t" />
      <SideHandles pos={Position.Bottom} id="b" />
    </>
  );
}

const STROKE_CYCLE: ('thin' | 'normal' | 'bold')[] = ['thin', 'normal', 'bold'];
const FONT_CYCLE: ('sm' | 'md' | 'lg')[] = ['sm', 'md', 'lg'];
const next = <T,>(arr: T[], cur: T): T => arr[(arr.indexOf(cur) + 1) % arr.length];

// Contextual toolbar shown above a selected node
export function NodeTools({ id, selected, data }: { id: string; selected?: boolean; data?: ModeNodeData }) {
  const actions = useNodeActions();
  const tr = useTr();
  if (!actions) return null;
  const sw = data?.strokeWidth ?? 'normal';
  const fz = data?.fontSize ?? 'md';
  const btn: React.CSSProperties = {
    border: 'none', background: 'none', cursor: 'pointer', fontSize: 13,
    padding: '4px 8px', borderRadius: 'var(--r-6)', color: 'var(--text-sub)', lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const sep = <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(var(--fg-rgb),0.12)', margin: '2px 1px' }} />;
  return (
    <NodeToolbar isVisible={!!selected} position={Position.Top} offset={8}>
      <div style={{ display: 'flex', gap: 2, padding: 'var(--space-4)', borderRadius: 'var(--r-8)', alignItems: 'center',
        background: 'var(--bg-elev)', border: '1px solid var(--line-strong)',
        boxShadow: 'var(--shadow-2)' }}>
        <button style={btn} title="Редактировать" aria-label="Редактировать" onClick={() => actions.edit(id)}><MMIcon name="edit" size={15} /></button>
        {sep}
        <button style={btn} title={`Толщина контура: ${({ thin: 'тонкий', normal: 'обычный', bold: 'жирный' } as const)[sw]} (${tr('нажми', 'нажмите')}, чтобы сменить)`}
          aria-label="Толщина контура"
          onClick={() => actions.patchData(id, { strokeWidth: next(STROKE_CYCLE, sw) })}>
          <span style={{ display: 'inline-block', width: 16, height: sw === 'thin' ? 1.5 : sw === 'bold' ? 4 : 2.5,
            borderRadius: 'var(--r-2)', background: 'var(--text-sub)' }} />
        </button>
        <button style={{ ...btn, fontWeight: 700, fontSize: fz === 'sm' ? 11 : fz === 'lg' ? 17 : 14 }}
          title={`Размер текста: ${({ sm: 'мелкий', md: 'средний', lg: 'крупный' } as const)[fz]} (${tr('нажми', 'нажмите')}, чтобы сменить)`}
          aria-label="Размер текста"
          onClick={() => actions.patchData(id, { fontSize: next(FONT_CYCLE, fz) })}>A</button>
        {sep}
        <button style={btn} title="Дублировать" aria-label="Дублировать" onClick={() => actions.duplicate(id)}><MMIcon name="copy" size={15} /></button>
        <button style={{ ...btn, color: 'var(--accent-red)' }} title="Удалить" aria-label="Удалить" onClick={() => actions.remove(id)}><MMIcon name="trash" size={15} /></button>
      </div>
    </NodeToolbar>
  );
}


// Partner badge for couple maps (А / Б) — small corner chip
export function SideBadge({ side }: { side?: 'A' | 'B' }) {
  if (!side) return null;
  const color = side === 'A' ? 'var(--accent-blue)' : 'var(--accent-orange)';
  return (
    <div style={{ position: 'absolute', top: -8, left: -8, zIndex: 4, width: 19, height: 19, borderRadius: '50%',
      background: color, color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: '2px solid var(--bg-elev)', pointerEvents: 'none' }}>
      {side === 'A' ? 'А' : 'Б'}
    </div>
  );
}

// hideSchema: у схемы случая своё название и есть schemaId — таблетка схемы под текстом дублировала бы заголовок.
export function NodeLabel({ id, data, light, hideSchema }: { id?: string; data: ModeNodeData; light?: boolean; hideSchema?: boolean }) {
  const actions = useNodeActions();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);
  const editRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (editing) editRef.current?.select(); }, [editing]);

  const display = data.display ?? 'full';
  const showNote = display !== 'name' && !!data.note;
  const showNeed = display === 'full' && !!data.unmetNeed;
  const showHealthy = display === 'full' && !!data.healthyResponse;
  const schema = data.schemaId ? getSchemaById(data.schemaId) : undefined;
  const showSchema = display !== 'name' && !!schema && !hideSchema;

  const startEdit = () => { if (id && actions) { setDraft(data.label); setEditing(true); } };
  const commit = () => { if (id && actions) actions.rename(id, draft.trim() || data.label); setEditing(false); };
  const fs = fontPx(data);
  const subFs = Math.max(10, fs - 2.5);

  return (
    <div style={{ textAlign: 'center', pointerEvents: 'all' }}>
      {editing ? (
        // Переносит строки, как подпись: узкий input прокручивался к концу и прятал начало («язвимый Ребёнок»).
        <textarea ref={editRef} value={draft} rows={draft.length > 14 ? 2 : 1}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') setEditing(false); e.stopPropagation(); }}
          onClick={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()} className="nodrag"
          style={{ width: '100%', fontSize: fs, fontWeight: 600, textAlign: 'center', lineHeight: 1.35, resize: 'none', fieldSizing: 'content',
            border: '1px solid var(--accent)', borderRadius: 'var(--r-4)', background: 'var(--bg-elev)', fontFamily: 'inherit',
            color: 'var(--text)', outline: 'none', padding: '1px 4px', boxSizing: 'border-box', overflow: 'hidden' }} />
      ) : (
        <div onDoubleClick={(e) => { e.stopPropagation(); startEdit(); }}
          style={{ fontSize: fs, fontWeight: 600, lineHeight: 1.35, wordBreak: 'break-word', cursor: id ? 'text' : 'default',
            color: light ? 'rgba(255,255,255,0.95)' : 'var(--text)' }}>{data.label}</div>
      )}
      {showNote && <div style={{ fontSize: subFs, marginTop: 'var(--space-4)', lineHeight: 1.3, wordBreak: 'break-word',
        color: light ? 'rgba(255,255,255,0.75)' : 'var(--text-sub)' }}>{data.note}</div>}
      {showNeed && <div style={{ fontSize: subFs - 1, marginTop: 4, lineHeight: 1.25, wordBreak: 'break-word', fontStyle: 'italic',
        color: light ? 'rgba(255,255,255,0.7)' : 'var(--accent)' }}>потребность: {data.unmetNeed}</div>}
      {showHealthy && <div style={{ fontSize: subFs - 1, marginTop: 4, lineHeight: 1.3, wordBreak: 'break-word',
        color: light ? 'rgba(255,255,255,0.8)' : 'var(--c-moss)' }}>{data.healthyResponse}</div>}
      {showSchema && schema && (
        <div style={{ marginTop: 'var(--space-6)', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-4)', maxWidth: '100%',
          padding: '2px 7px', borderRadius: 999, fontSize: subFs - 1.5, lineHeight: 1.2,
          background: light ? 'rgba(255,255,255,0.18)' : `color-mix(in srgb, ${schema.domainColor} 14%, transparent)`,
          border: `1px solid ${light ? 'rgba(255,255,255,0.3)' : `color-mix(in srgb, ${schema.domainColor} 40%, transparent)`}`,
          color: light ? 'rgba(255,255,255,0.92)' : schema.domainColor }}>
          <IdentityDot color={schema.domainColor} size={7} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{schema.name}</span>
        </div>
      )}
    </div>
  );
}
