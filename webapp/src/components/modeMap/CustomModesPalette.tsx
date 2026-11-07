import { useRef, useState } from 'react';
import { api, type ModeMapNode, type TherapistCustomMode } from '../../api';
import { CUSTOM_MODE_NAME_MAX } from '../../../../shared/src/limits/textLimits';
import { scrollIntoViewSafe } from '../../../../shared/src/utils/scrollIntoView';
import { useTr } from '../../utils/addressForm';
import { MMIcon } from '../modeMapIcons';
import type { NodeType } from '../modeMapData';
import { ShapePicker } from './ShapePicker';
import type { Draft } from './modeDraft';
import { Sign } from '../therapist/SignArt';
import type { CustomModesState } from './useCustomModes';

function nodeData(m: TherapistCustomMode): ModeMapNode['data'] {
  const base: ModeMapNode['data'] = { label: m.name };
  if (m.nodeType === 'coping') base.copingSubtype = 'over';
  return base;
}
const customDraft = (m: TherapistCustomMode): Draft => ({ id: `cm_${m.id}_${Date.now()}`, type: m.nodeType as NodeType, data: nodeData(m) });

interface Props {
  state: CustomModesState;
  setState: React.Dispatch<React.SetStateAction<CustomModesState>>;
  /** Режимы, показанные в списке (при поиске — только совпавшие). */
  list: TherapistCustomMode[];
  /** Идёт поиск: без «+», формы и подсказок. */
  searching: boolean;
  onAdd: (node: Draft) => void;
  onDragStart: (e: React.DragEvent, node: Draft) => void;
}

/** Секция палитры «Мои режимы»: свои режимы терапевта (вне групп — общий знак режимов Cluster) и форма добавления. */
export function CustomModesPalette({ state, setState, list, searching, onAdd, onDragStart }: Props) {
  const tr = useTr();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('⬡');
  const [newType, setNewType] = useState<NodeType>('custom');
  const [newCopingSub, setNewCopingSub] = useState<'over' | 'avoid' | 'surr'>('over');
  const addInputRef = useRef<HTMLInputElement>(null);
  const addFormRef = useRef<HTMLDivElement>(null);

  async function save() {
    if (!newName.trim()) return;
    const m = await api.createCustomMode({ name: newName.trim(), emoji: newEmoji, nodeType: newType });
    setState(prev => [...(Array.isArray(prev) ? prev : []), m]);
    setNewName(''); setNewEmoji('⬡'); setAdding(false);
  }
  async function remove(id: number) {
    await api.deleteCustomMode(id);
    setState(prev => Array.isArray(prev) ? prev.filter(m => m.id !== id) : prev);
  }
  const toggleForm = () => {
    const next = !adding;
    setAdding(next);
    if (next) setTimeout(() => { scrollIntoViewSafe(addFormRef.current, { block: 'nearest' }); addInputRef.current?.focus(); }, 60);
  };

  if (searching && list.length === 0) return null;
  const all = Array.isArray(state) ? state : [];
  return (
    <div className="mm2-mine">
      <div className="mm2-mine-head">
        <Sign kind="cluster" /><span className="mm2-pal-head-name">Мои режимы</span>
        {!searching && (
          <button onClick={toggleForm} className="mm2-mine-plus" title="Добавить свой режим" aria-label="Добавить свой режим">
            <MMIcon name="plus" size={15} />
          </button>
        )}
      </div>

      {!searching && adding && (
        <div ref={addFormRef} className="mm2-add-form">
          <div className="mm2-add-row">
            <input ref={addInputRef} value={newEmoji} onChange={e => setNewEmoji(e.target.value)}
              className="ds-input mm2-add-emoji" maxLength={2} />
            <input value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setAdding(false); }}
              placeholder="Название…" maxLength={CUSTOM_MODE_NAME_MAX} className="ds-input" />
          </div>
          <ShapePicker newType={newType} newCopingSub={newCopingSub} setNewType={setNewType} setNewCopingSub={setNewCopingSub} />
          <div className="mm2-add-row">
            <button onClick={save} className="ds-btn ds-btn--sm">Сохранить</button>
            <button onClick={() => setAdding(false)} aria-label="Отменить" className="ds-btn ds-btn--icon ds-btn--sm"><MMIcon name="close" size={13} /></button>
          </div>
        </div>
      )}

      {list.map(m => (
        <div key={m.id} className="mm2-mine-row">
          <button onClick={() => onAdd(customDraft(m))} draggable onDragStart={e => onDragStart(e, customDraft(m))}
            className="mm2-pal-item is-lg">
            <span>{m.emoji}</span>
            <span className="mm2-pal-item-name">{m.name}</span>
          </button>
          {!searching && (
            <button onClick={() => remove(m.id)} className="mm2-mine-del" title="Удалить" aria-label="Удалить"><MMIcon name="close" size={11} /></button>
          )}
        </div>
      ))}

      {!searching && state === 'failed' && (
        <div className="mm2-pal-sub is-err">{tr('Не удалось загрузить твои режимы', 'Не удалось загрузить ваши режимы')}</div>
      )}
      {!searching && state !== 'failed' && all.length === 0 && !adding && (
        <div className="mm2-pal-sub">
          {tr('Добавь режимы, с которыми', 'Добавьте режимы, с которыми')}<br />{tr('работаешь чаще всего', 'работаете чаще всего')}
        </div>
      )}
    </div>
  );
}
