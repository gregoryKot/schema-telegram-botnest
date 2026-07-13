import { useEffect, useRef, useState } from 'react';
import type { ModeMapNode, ModeMapEdge, EdgeType } from '../api';
import { TYPE_COLORS } from './ModeMapNodes';
import { MMIcon } from './modeMapIcons';
import { useTr } from '../utils/addressForm';
import { NEED_ORDER, getNeedData } from '../needData';
import { SCHEMA_DOMAINS } from '../schemaTherapyData';

// Preview fill — token-aware (color-mix) with a legacy-hex fallback.
const previewFill = (c: string) => c.startsWith('#') ? `${c}22` : `color-mix(in srgb, ${c} 14%, transparent)`;

// Human-readable name for a --c-* color token, for aria-label/title on color swatches.
const COLOR_TOKEN_NAMES: Record<string, string> = {
  teal: 'Бирюзовый', rose: 'Розовый', clay: 'Терракотовый', moss: 'Оливковый',
  plum: 'Сливовый', ochre: 'Охра', slate: 'Серый', amber: 'Янтарный',
};
const colorPresetLabel = (c: string) => {
  const m = c.match(/--c-([a-z]+)/);
  return (m && COLOR_TOKEN_NAMES[m[1]]) || 'Цвет';
};

// 5 core emotional needs (schema therapy) — datalist options for unmet need
const CORE_NEEDS = NEED_ORDER.map(id => getNeedData('ty')[id]?.name).filter(Boolean) as string[];

type CopingSubtype = 'over' | 'avoid' | 'surr';

type Question = { text: string; target: 'note' | 'need' | 'healthy' };

// Type-specific clinical questions. `target` says which field the question
// guides — clicking it focuses that field.
function clinicalQuestions(node: ModeMapNode): Question[] {
  const sub = node.data.copingSubtype;
  const note = (text: string): Question => ({ text, target: 'note' });
  const need = (text: string): Question => ({ text, target: 'need' });
  const heal = (text: string): Question => ({ text, target: 'healthy' });
  switch (node.type) {
    case 'trigger':
      return [note('Что конкретно произошло?'), note('Что клиент увидел, услышал, вспомнил?')];
    case 'child':
      return [note('Что чувствует эта часть?'), need('Какая детская потребность не удовлетворена?'), heal('Что сказал бы ребёнку Здоровый Взрослый?')];
    case 'critic':
      return [note('Чей это голос?'), note('Что говорит дословно?'), heal('Что ответил бы критику Здоровый Взрослый?')];
    case 'coping':
      if (sub === 'avoid')  return [note('От чего уводит?'), note('Какую боль ребёнка прячет?'), heal('Что сказал бы Здоровый Взрослый?')];
      if (sub === 'surr')   return [note('Кому подчиняется?'), note('Какую боль ребёнка прячет?'), heal('Что сказал бы Здоровый Взрослый?')];
      return [note('От какой боли защищает?'), note('Какую цену клиент платит?'), heal('Что сказал бы Здоровый Взрослый?')];
    case 'healthy':
      return [note('Кого защищает?'), note('Кому ставит границы?'), need('Какие потребности удовлетворяет?')];
    case 'behavior':
      return [note('Что конкретно делает клиент?'), note('К каким последствиям это ведёт?')];
    default:
      return [note('Как этот режим проявляется?'), note('Что он делает в поведении?')];
  }
}

function ClinicalHint({ node, onPickNote, onPickNeed, onPickHealthy }: {
  node: ModeMapNode; onPickNote: () => void; onPickNeed: () => void; onPickHealthy: () => void;
}) {
  const tr = useTr();
  const qs = clinicalQuestions(node);
  return (
    <div style={{
      background: 'var(--accent-soft)', borderRadius: 7, padding: '8px 10px', marginBottom: 14,
      border: '1px solid var(--accent-line)',
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
        <MMIcon name="bulb" size={13} /> Спросить себя
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {qs.map((q, i) => (
          <button key={i}
            onClick={() => (q.target === 'need' ? onPickNeed() : q.target === 'healthy' ? onPickHealthy() : onPickNote())}
            title={tr('Нажми, чтобы заполнить поле', 'Нажмите, чтобы заполнить поле')}
            style={{ display: 'flex', gap: 6, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
              padding: '3px 4px', borderRadius: 5, fontSize: 11.5, color: 'var(--text-sub)', lineHeight: 1.35 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
            <span style={{ color: 'var(--accent)', flexShrink: 0 }}>→</span>{q.text}
          </button>
        ))}
      </div>
    </div>
  );
}

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

const COLOR_PRESETS = [
  'var(--c-teal)','var(--c-rose)','var(--c-clay)','var(--c-moss)',
  'var(--c-plum)','var(--c-ochre)','var(--c-slate)','var(--c-amber)',
];

type NodeType = ModeMapNode['type'];

interface ShapeOption {
  type: NodeType;
  label: string;
  copingSubtype?: CopingSubtype;
  color: string;
  clip?: string;
  radius?: number | string;
  isCircle?: boolean;
  isCloud?: boolean;
}

const SHAPE_OPTIONS: ShapeOption[] = [
  { type: 'trigger',  label: 'Триггер', color: TYPE_COLORS.trigger, isCloud: true },
  { type: 'child',    label: 'Детский', color: TYPE_COLORS.child,   isCircle: true },
  { type: 'critic',   label: 'Критик',  color: TYPE_COLORS.critic },
  { type: 'coping',   label: 'Гипер',   color: TYPE_COLORS.coping, copingSubtype: 'over' },
  { type: 'coping',   label: 'Избег',   color: TYPE_COLORS.coping, copingSubtype: 'avoid' },
  { type: 'coping',   label: 'Капит',   color: TYPE_COLORS.coping, copingSubtype: 'surr' },
  { type: 'healthy',  label: 'Здоров',  color: TYPE_COLORS.healthy },
  { type: 'behavior', label: 'Повед.',  color: TYPE_COLORS.behavior },
  { type: 'custom',   label: 'Свой',    color: TYPE_COLORS.custom },
];

// All previews drawn in a fixed 24x24 box so picker borders align perfectly
function ShapePreview({ opt, active }: { opt: ShapeOption; active: boolean }) {
  const stroke = active ? 'var(--accent)' : opt.color;
  const fill = previewFill(opt.color);
  const sw = 1.6;
  const paths: Record<string, string> = {
    critic: 'M4,1 L20,1 L23,4 L23,20 L20,23 L4,23 L1,20 L1,4 Z',     // octagon
    over:   'M12,1 L23,9 L19,23 L5,23 L1,9 Z',                        // pentagon
    avoid:  'M2,2 L22,2 L22,16 L12,23 L2,16 Z',                       // shield
  };
  const key = opt.copingSubtype === 'over' ? 'over'
    : opt.copingSubtype === 'avoid' ? 'avoid'
    : opt.type === 'critic' ? 'critic' : null;

  return (
    <svg width={22} height={22} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      {opt.isCloud ? (
        <path d="M6,18 Q2,18 2,14 Q2,9 7,9 Q6,3 12,3 Q16,1 19,4 Q23,4 23,9 Q23,18 18,18 Z"
          fill={fill} stroke={stroke} strokeWidth={sw} />
      ) : opt.isCircle ? (
        <circle cx={12} cy={12} r={10.5} fill={fill} stroke={stroke} strokeWidth={sw} />
      ) : opt.copingSubtype === 'surr' ? (
        <rect x={1} y={6} width={22} height={12} rx={6} fill={fill} stroke={stroke} strokeWidth={sw} />
      ) : opt.type === 'behavior' ? (
        <path d="M2,4 L18,4 L22,12 L18,20 L2,20 Z" fill={fill} stroke={stroke} strokeWidth={sw} />
      ) : key ? (
        <path d={paths[key]} fill={fill} stroke={stroke} strokeWidth={sw} />
      ) : (
        <rect x={2} y={4} width={20} height={16} rx={3} fill={fill} stroke={stroke} strokeWidth={sw} />
      )}
    </svg>
  );
}

interface NodeEditorProps {
  node: ModeMapNode;
  onChange: (updated: ModeMapNode) => void;
  onDelete: () => void;
  onClose: () => void;
  coupleMode?: boolean;   // карта пары → показать выбор партнёра
}

export function ModeMapNodeEditor({ node, onChange, onDelete, onClose, coupleMode }: NodeEditorProps) {
  const tr = useTr();
  const nameRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const needRef = useRef<HTMLInputElement>(null);
  const healthyRef = useRef<HTMLTextAreaElement>(null);

  const patchData = (d: Partial<ModeMapNode['data']>) =>
    onChange({ ...node, data: { ...node.data, ...d } });
  const patchShape = (opt: ShapeOption) => onChange({
    ...node,
    type: opt.type,
    data: { ...node.data, copingSubtype: opt.copingSubtype },
  });
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

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>Режим</div>
        <button onClick={onClose} title="Закрыть" aria-label="Закрыть" style={closeBtnStyle}><MMIcon name="close" size={15} /></button>
      </div>

      <label style={labelStyle}>Название</label>
      <input ref={nameRef} style={inputStyle} value={node.data.label}
        onChange={e => patchData({ label: e.target.value })} placeholder="Название режима" />

      {coupleMode && (
        <>
          <label style={labelStyle}>Чей режим</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {([
              { v: 'A' as const, label: 'Партнёр А', color: 'var(--accent-blue)' },
              { v: 'B' as const, label: 'Партнёр Б', color: 'var(--accent-orange)' },
            ]).map(opt => {
              const active = node.data.side === opt.v;
              return (
                <button key={opt.v} onClick={() => patchData({ side: active ? undefined : opt.v })}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '7px 4px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                    border: `1.5px solid ${active ? opt.color : 'rgba(var(--fg-rgb),0.14)'}`,
                    background: active ? `color-mix(in srgb, ${opt.color} 14%, transparent)` : 'none',
                    color: active ? opt.color : 'var(--text-sub)', fontWeight: active ? 600 : 400 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: opt.color }} />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      <label style={labelStyle}>Форма и тип</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5, marginBottom: 14 }}>
        {SHAPE_OPTIONS.map((opt, i) => {
          const isActive = node.type === opt.type &&
            (node.type === 'coping' ? node.data.copingSubtype === opt.copingSubtype : true);
          return (
            <button key={i} onClick={() => patchShape(opt)} title={opt.label}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 3, height: 46, borderRadius: 7, cursor: 'pointer', boxSizing: 'border-box',
                border: `1.5px solid ${isActive ? 'var(--accent)' : 'var(--line-strong)'}`,
                background: isActive ? 'var(--accent-soft)' : 'none', padding: 2,
              }}>
              <ShapePreview opt={opt} active={isActive} />
              <span style={{ fontSize: 8.5, color: isActive ? 'var(--accent)' : 'var(--text-faint)', lineHeight: 1, textAlign: 'center', whiteSpace: 'nowrap' }}>
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>

      <label style={labelStyle}>Цвет</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {COLOR_PRESETS.map(c => (
          <button key={c} onClick={() => patchData({ customColor: c })}
            aria-label={colorPresetLabel(c)} title={colorPresetLabel(c)}
            style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', padding: 0,
              border: currentColor === c ? '2px solid var(--text)' : '2px solid transparent' }} />
        ))}
        <button onClick={() => patchData({ customColor: undefined })} title="Сбросить" aria-label="Сбросить"
          style={{ width: 22, height: 22, borderRadius: '50%', background: 'none', cursor: 'pointer', padding: 0,
            border: '2px dashed var(--line-strong)', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MMIcon name="close" size={11} /></button>
      </div>

      <label style={labelStyle}>Заливка</label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {([
          { label: 'Лёгкая', filled: false, fillFull: false },
          { label: 'Средняя', filled: true,  fillFull: false },
          { label: 'Полная',  filled: false, fillFull: true  },
        ] as const).map(opt => {
          const active = !!node.data.fillFull === opt.fillFull && !!node.data.filled === opt.filled;
          return (
            <button key={opt.label} onClick={() => patchData({ filled: opt.filled, fillFull: opt.fillFull })}
              style={{ flex: 1, padding: '6px 4px', borderRadius: 6, fontSize: 11.5, cursor: 'pointer',
                border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line-strong)'}`,
                background: active ? 'var(--accent-soft)' : 'none',
                color: active ? 'var(--accent)' : 'var(--text-sub)' }}>
              {opt.label}
            </button>
          );
        })}
      </div>

      <label style={labelStyle}>Толщина контура</label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {([
          { v: 'thin' as const,   label: 'Тонкий', h: 1.5 },
          { v: 'normal' as const, label: 'Обычный', h: 2.5 },
          { v: 'bold' as const,   label: 'Жирный', h: 4 },
        ]).map(opt => {
          const active = (node.data.strokeWidth ?? 'normal') === opt.v;
          return (
            <button key={opt.v} onClick={() => patchData({ strokeWidth: opt.v })} title={opt.label} aria-label={opt.label}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                padding: '8px 4px', borderRadius: 6, cursor: 'pointer',
                border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line-strong)'}`,
                background: active ? 'var(--accent-soft)' : 'none' }}>
              <span style={{ width: 26, height: opt.h, borderRadius: opt.h, background: active ? 'var(--accent)' : 'var(--text-sub)' }} />
              <span style={{ fontSize: 9, color: active ? 'var(--accent)' : 'var(--text-faint)' }}>{opt.label}</span>
            </button>
          );
        })}
      </div>

      <label style={labelStyle}>Размер текста</label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {([
          { v: 'sm' as const, label: 'A', fs: 11 },
          { v: 'md' as const, label: 'A', fs: 14 },
          { v: 'lg' as const, label: 'A', fs: 18 },
        ]).map(opt => {
          const active = (node.data.fontSize ?? 'md') === opt.v;
          return (
            <button key={opt.v} onClick={() => patchData({ fontSize: opt.v })}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 38,
                borderRadius: 6, cursor: 'pointer',
                border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line-strong)'}`,
                background: active ? 'var(--accent-soft)' : 'none',
                color: active ? 'var(--accent)' : 'var(--text-sub)', fontSize: opt.fs, fontWeight: 600 }}>
              {opt.label}
            </button>
          );
        })}
      </div>

      <label style={labelStyle}>Что показывать на фигуре</label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {([
          { v: 'name' as const, label: 'Имя' },
          { v: 'note' as const, label: '+ Заметка' },
          { v: 'full' as const, label: 'Всё' },
        ]).map(opt => {
          const active = (node.data.display ?? 'full') === opt.v;
          return (
            <button key={opt.v} onClick={() => patchData({ display: opt.v })}
              style={{ flex: 1, padding: '6px 4px', borderRadius: 6, fontSize: 11.5, cursor: 'pointer',
                border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line-strong)'}`,
                background: active ? 'var(--accent-soft)' : 'none',
                color: active ? 'var(--accent)' : 'var(--text-sub)' }}>
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Clinical questions — click a question to jump to the field it guides */}
      <ClinicalHint node={node}
        onPickNote={() => { noteRef.current?.focus(); }}
        onPickNeed={() => { needRef.current?.focus(); }}
        onPickHealthy={() => { healthyRef.current?.focus(); healthyRef.current?.scrollIntoView({ block: 'nearest' }); }} />

      <label style={labelStyle}>Заметка</label>
      <textarea ref={noteRef} style={{ ...inputStyle, resize: 'vertical', minHeight: 56 }} rows={3}
        value={node.data.note ?? ''} onChange={e => patchData({ note: e.target.value || undefined })}
        placeholder="Как этот режим проявляется у клиента" />

      <label style={labelStyle}>Связанная схема</label>
      <select value={node.data.schemaId ?? ''} onChange={e => patchData({ schemaId: e.target.value || undefined })}
        style={{ ...inputStyle, appearance: 'auto', cursor: 'pointer' }}>
        <option value="">— не выбрана —</option>
        {SCHEMA_DOMAINS.map(d => (
          <optgroup key={d.id} label={d.domain}>
            {d.schemas.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </optgroup>
        ))}
      </select>

      {(node.type === 'child' || node.type === 'custom') && (
        <>
          <label style={labelStyle}>Неудовлетворённая потребность</label>
          <input ref={needRef} style={inputStyle} list="modemap-needs" value={node.data.unmetNeed ?? ''}
            onChange={e => patchData({ unmetNeed: e.target.value || undefined })}
            placeholder="Выбери или впиши свою…" />
          <datalist id="modemap-needs">
            {CORE_NEEDS.map(n => <option key={n} value={n} />)}
          </datalist>
        </>
      )}

      {(node.type === 'child' || node.type === 'critic' || node.type === 'coping') && (
        <>
          <label style={{ ...labelStyle, color: 'var(--accent-green)' }}>🌿 Что сказал бы Здоровый Взрослый</label>
          <textarea ref={healthyRef} style={{ ...inputStyle, resize: 'vertical', minHeight: 48,
            borderColor: 'color-mix(in srgb, var(--c-moss) 45%, transparent)' }} rows={2}
            value={node.data.healthyResponse ?? ''} onChange={e => patchData({ healthyResponse: e.target.value || undefined })}
            placeholder={node.type === 'critic' ? tr('Ответ критику: «Ты не обязан быть идеальным…»', 'Ответ критику: «Вы не обязаны быть идеальным…»')
              : node.type === 'coping' ? 'Зачем защита? «Я могу выдержать эту боль…»'
              : tr('Поддержка ребёнку: «Я с тобой, ты в безопасности…»', 'Поддержка ребёнку: «Я с тобой, ты в безопасности…»')} />
        </>
      )}

      <button onClick={onDelete} style={deleteBtnStyle}>Удалить ноду</button>
    </div>
  );
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

      <label style={labelStyle}>Тип связи (вставит подпись)</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {Object.entries(EDGE_TYPE_LABELS).map(([k, v]) => (
          <button key={k}
            onClick={() => chooseType(k)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 14, textAlign: 'left', fontSize: 12, cursor: 'pointer',
              border: `1px solid ${edgeType === k ? 'var(--accent)' : 'var(--line-strong)'}`,
              background: edgeType === k ? 'var(--accent-soft)' : 'none',
              color: edgeType === k ? 'var(--accent)' : 'var(--text-sub)' }}>
            <span style={{ fontSize: 11, opacity: 0.7 }}>→</span>
            {v}
          </button>
        ))}
      </div>

      {/* Suggestion box — pick a phrase for the line or refresh for more */}
      <div style={{ marginBottom: 14, padding: '8px 9px', borderRadius: 8,
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
                style={{ padding: '4px 9px', borderRadius: 14, fontSize: 11.5, cursor: 'pointer',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--line-strong)'}`,
                  background: active ? 'var(--accent-soft)' : 'var(--bg-elev)',
                  color: active ? 'var(--accent)' : 'var(--text-sub)' }}>
                {p}
              </button>
            );
          })}
        </div>
      </div>

      <label style={labelStyle}>Подпись (необязательно)</label>
      <input style={inputStyle}
        value={edge.label ?? ''}
        onChange={e => onChange({ ...edge, label: e.target.value || undefined })}
        placeholder="Текст на стрелке" />

      <label style={labelStyle}>Стиль линии</label>
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
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '7px 4px', borderRadius: 6, cursor: 'pointer',
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

      <label style={labelStyle}>Толщина линии</label>
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
                padding: '8px 4px', borderRadius: 6, cursor: 'pointer',
                border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line-strong)'}`,
                background: active ? 'var(--accent-soft)' : 'none' }}>
              <span style={{ width: 28, height: opt.h, borderRadius: opt.h, background: active ? 'var(--accent)' : 'var(--text-sub)' }} />
              <span style={{ fontSize: 9, color: active ? 'var(--accent)' : 'var(--text-faint)' }}>{opt.label}</span>
            </button>
          );
        })}
      </div>

      <label style={labelStyle}>Направление</label>
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

      <label style={labelStyle}>Цвет стрелки</label>
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
    gap: 2, padding: '6px 4px', borderRadius: 6, cursor: 'pointer',
    border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line-strong)'}`,
    background: active ? 'var(--accent-soft)' : 'none',
    color: active ? 'var(--accent)' : 'var(--text-sub)',
  };
}

const closeBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)',
  fontSize: 13, padding: '2px 4px', lineHeight: 1,
};

const panelStyle: React.CSSProperties = {
  width: 230, flexShrink: 0,
  borderLeft: '1px solid var(--line)',
  padding: '16px 14px', overflowY: 'auto',
  background: 'var(--surface-2)',
  display: 'flex', flexDirection: 'column',
};
const labelStyle: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.05em', color: 'var(--text-faint)', marginBottom: 5, display: 'block',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid var(--line-strong)',
  background: 'var(--bg-elev)', color: 'var(--text)',
  fontSize: 13, marginBottom: 14, boxSizing: 'border-box', outline: 'none',
};
const deleteBtnStyle: React.CSSProperties = {
  marginTop: 'auto', padding: '8px 12px', borderRadius: 6,
  border: '1px solid var(--line)',
  background: 'none', color: 'var(--accent-red)', fontSize: 12.5, cursor: 'pointer',
};
