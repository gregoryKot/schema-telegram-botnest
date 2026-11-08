import { useRef, useState } from 'react';
import { api } from '../../api';
import { CUSTOM_MODE_NAME_MAX } from '../../../../shared/src/limits/textLimits';
import { scrollIntoViewSafe } from '../../../../shared/src/utils/scrollIntoView';
import { useTr } from '../../utils/addressForm';
import { Cluster } from '../art/PaperArtSigns';
import { MMIcon } from '../modeMapIcons';
import type { NodeType } from '../modeMapData';
import { ShapePicker } from './ShapePicker';
import type { Draft } from './modeDraft';
import { customItem } from './paletteModel';
import { PaletteHead, PaletteRow } from './PaletteParts';
import type { CustomModesState } from './useCustomModes';

interface Props {
  state: CustomModesState;
  setState: React.Dispatch<React.SetStateAction<CustomModesState>>;
  onAdd: (node: Draft) => void;
}

/**
 * Секция палитры «Мои режимы»: свои режимы терапевта (вне групп — общий знак режимов Cluster),
 * форма добавления и удаление. Пока своих режимов нет, секция стоит в каталоге; появились —
 * в блоке «Этот клиент» (ModeMapPalette): их кладут на карту почти всегда.
 */
export function CustomModesPalette({ state, setState, onAdd }: Props) {
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

  const all = Array.isArray(state) ? state : [];
  return (
    <div className="mm2-sec">
      <PaletteHead art={<Cluster size="row" />} title="Мои режимы">
        <button onClick={toggleForm} className="mm2-mine-plus" title="Добавить свой режим" aria-label="Добавить свой режим">
          <MMIcon name="plus" size={15} />
        </button>
      </PaletteHead>

      {adding && (
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

      {all.map(m => (
        <div key={m.id} className="mm2-mine-row">
          <PaletteRow item={customItem(m)} onAdd={onAdd} />
          <button onClick={() => remove(m.id)} className="mm2-mine-del" title="Удалить" aria-label="Удалить"><MMIcon name="close" size={11} /></button>
        </div>
      ))}

      {state === 'failed' && (
        <div className="mm2-pal-sub is-err">{tr('Не удалось загрузить твои режимы', 'Не удалось загрузить ваши режимы')}</div>
      )}
      {state !== 'failed' && all.length === 0 && !adding && (
        <div className="mm2-pal-sub">
          {tr('Добавь режимы, с которыми работаешь чаще всего', 'Добавьте режимы, с которыми работаете чаще всего')}
        </div>
      )}
    </div>
  );
}
