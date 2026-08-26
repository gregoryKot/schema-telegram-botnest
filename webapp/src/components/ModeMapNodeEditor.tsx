import { useEffect, useRef } from 'react';
import type { ModeMapNode } from '../api';
import { TYPE_COLORS } from './modeMapData';
import { MMIcon } from './modeMapIcons';
import { useTr } from '../utils/addressForm';
import { NEED_ORDER, getNeedData } from '../needData';
import { SCHEMA_DOMAINS } from '../schemaTherapyData';
import { ClinicalHint } from './modeMap/ClinicalHint';
import { ShapePreview } from './modeMap/ShapePreview';
import { SHAPE_OPTIONS, type ShapeOption } from './modeMap/shapeOptions';
import {
  panelStyle, labelStyle, inputStyle, deleteBtnStyle, closeBtnStyle,
  colorPresetLabel, COLOR_PRESETS,
} from './modeMap/editorStyles';

// Панель редактирования связи жила в этом же файле — вынесена (правило №10);
// ре-экспорт сохраняет прежний путь импорта у консьюмеров.
export { ModeMapEdgeEditor } from './modeMap/ModeMapEdgeEditor';

// 5 core emotional needs (schema therapy) — datalist options for unmet need
const CORE_NEEDS = NEED_ORDER.map(id => getNeedData('ty')[id]?.name).filter(Boolean) as string[];

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

      <label style={labelStyle} htmlFor="mm-node-name">Название</label>
      <input id="mm-node-name" ref={nameRef} style={inputStyle} value={node.data.label}
        onChange={e => patchData({ label: e.target.value })} placeholder="Название режима" />

      {coupleMode && (
        <>
          <div style={labelStyle}>Чей режим</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {([
              { v: 'A' as const, label: 'Партнёр А', color: 'var(--accent-blue)' },
              { v: 'B' as const, label: 'Партнёр Б', color: 'var(--accent-orange)' },
            ]).map(opt => {
              const active = node.data.side === opt.v;
              return (
                <button key={opt.v} onClick={() => patchData({ side: active ? undefined : opt.v })}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '7px 4px', borderRadius: 'var(--r-6)', fontSize: 12, cursor: 'pointer',
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

      <div style={labelStyle}>Форма и тип</div>
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

      <div style={labelStyle}>Цвет</div>
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

      <div style={labelStyle}>Заливка</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {([
          { label: 'Лёгкая', filled: false, fillFull: false },
          { label: 'Средняя', filled: true,  fillFull: false },
          { label: 'Полная',  filled: false, fillFull: true  },
        ] as const).map(opt => {
          const active = !!node.data.fillFull === opt.fillFull && !!node.data.filled === opt.filled;
          return (
            <button key={opt.label} onClick={() => patchData({ filled: opt.filled, fillFull: opt.fillFull })}
              style={{ flex: 1, padding: '6px 4px', borderRadius: 'var(--r-6)', fontSize: 11.5, cursor: 'pointer',
                border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line-strong)'}`,
                background: active ? 'var(--accent-soft)' : 'none',
                color: active ? 'var(--accent)' : 'var(--text-sub)' }}>
              {opt.label}
            </button>
          );
        })}
      </div>

      <div style={labelStyle}>Толщина контура</div>
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
                padding: '8px 4px', borderRadius: 'var(--r-6)', cursor: 'pointer',
                border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line-strong)'}`,
                background: active ? 'var(--accent-soft)' : 'none' }}>
              <span style={{ width: 26, height: opt.h, borderRadius: opt.h, background: active ? 'var(--accent)' : 'var(--text-sub)' }} />
              <span style={{ fontSize: 9, color: active ? 'var(--accent)' : 'var(--text-faint)' }}>{opt.label}</span>
            </button>
          );
        })}
      </div>

      <div style={labelStyle}>Размер текста</div>
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
                borderRadius: 'var(--r-6)', cursor: 'pointer',
                border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line-strong)'}`,
                background: active ? 'var(--accent-soft)' : 'none',
                color: active ? 'var(--accent)' : 'var(--text-sub)', fontSize: opt.fs, fontWeight: 600 }}>
              {opt.label}
            </button>
          );
        })}
      </div>

      <div style={labelStyle}>Что показывать на фигуре</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {([
          { v: 'name' as const, label: 'Имя' },
          { v: 'note' as const, label: '+ Заметка' },
          { v: 'full' as const, label: 'Всё' },
        ]).map(opt => {
          const active = (node.data.display ?? 'full') === opt.v;
          return (
            <button key={opt.v} onClick={() => patchData({ display: opt.v })}
              style={{ flex: 1, padding: '6px 4px', borderRadius: 'var(--r-6)', fontSize: 11.5, cursor: 'pointer',
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

      <label style={labelStyle} htmlFor="mm-node-note">Заметка</label>
      <textarea id="mm-node-note" ref={noteRef} style={{ ...inputStyle, resize: 'vertical', minHeight: 56 }} rows={3}
        value={node.data.note ?? ''} onChange={e => patchData({ note: e.target.value || undefined })}
        placeholder="Как этот режим проявляется у клиента" />

      <label style={labelStyle} htmlFor="mm-node-schema">Связанная схема</label>
      <select id="mm-node-schema" value={node.data.schemaId ?? ''} onChange={e => patchData({ schemaId: e.target.value || undefined })}
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
          <label style={labelStyle} htmlFor="mm-node-need">Неудовлетворённая потребность</label>
          <input id="mm-node-need" ref={needRef} style={inputStyle} list="modemap-needs" value={node.data.unmetNeed ?? ''}
            onChange={e => patchData({ unmetNeed: e.target.value || undefined })}
            placeholder={tr('Выбери или впиши свою…', 'Выберите или впишите свою…')} />
          <datalist id="modemap-needs">
            {CORE_NEEDS.map(n => <option key={n} value={n} />)}
          </datalist>
        </>
      )}

      {(node.type === 'child' || node.type === 'critic' || node.type === 'coping') && (
        <>
          <label style={{ ...labelStyle, color: 'var(--accent-green)' }} htmlFor="mm-node-healthy">Что сказал бы Здоровый Взрослый</label>
          <textarea id="mm-node-healthy" ref={healthyRef} style={{ ...inputStyle, resize: 'vertical', minHeight: 48,
            borderColor: 'color-mix(in srgb, var(--c-moss) 45%, transparent)' }} rows={2}
            value={node.data.healthyResponse ?? ''} onChange={e => patchData({ healthyResponse: e.target.value || undefined })}
            placeholder={node.type === 'critic' ? tr('Ответ критику: «От тебя не требуется безупречность…»', 'Ответ критику: «От вас не требуется безупречность…»')
              : node.type === 'coping' ? 'Зачем защита? «Я могу выдержать эту боль…»'
              : tr('Поддержка ребёнку: «Я с тобой, ты в безопасности…»', 'Поддержка ребёнку: «Я с тобой, ты в безопасности…»')} />
        </>
      )}

      <button onClick={onDelete} style={deleteBtnStyle}>Удалить ноду</button>
    </div>
  );
}
