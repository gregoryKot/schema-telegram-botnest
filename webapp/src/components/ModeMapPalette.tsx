import { useState } from 'react';
import { MODE_GROUPS, SCHEMA_DOMAINS } from '../schemaTherapyData';
import { type ModeMapNode } from '../api';
import { GROUP_TO_TYPE, TYPE_COLORS } from './modeMapData';
import { IdentityDot } from '../../../shared/src/components/IdentityDot';
import { ConceptPaletteItems } from './modeMap/ConceptPaletteItems';
import { ClientSchemasPalette } from './modeMap/ClientSchemasPalette';
import { ClientModesPalette } from './modeMap/ClientModesPalette';
import { CustomModesPalette } from './modeMap/CustomModesPalette';
import { useCustomModes } from './modeMap/useCustomModes';
import { PaletteGroup, type PaletteGroupItem } from './modeMap/PaletteGroup';
import { GuideSignArt } from './art/GuideSigns';
import { DomainArt } from './art/DomainArt';
import { modeGroupSign } from './art/guideSignsModel';
import { startNodeDrag } from './modeMap/nodeDrag';
import { makeModeNode } from './modeMap/modeDraft';
import { schemaNode } from './modeMap/schemaDraft';
import { matchCustomModes, matchDomainSchemas, matchGroupItems, matchesBehavior, matchesTrigger, normalizeQuery } from './modeMap/paletteSearch';
import '../styles/sheet-modemap.css';

// Clinical display order: child → critic → coping(×3) → healthy
const GROUP_ORDER = ['child', 'critic', 'coping_overcompensation', 'coping_avoidance', 'coping_surrender', 'healthy'];
const SORTED_GROUPS = [...MODE_GROUPS].sort((a, b) => GROUP_ORDER.indexOf(a.id) - GROUP_ORDER.indexOf(b.id));
const domainKey = (id: string) => `domain:${id}`; // id доменов и групп режимов не пересекаются

interface Props { onAdd: (node: Omit<ModeMapNode, 'position'>) => void; onAddMany?: (nodes: Omit<ModeMapNode, 'position'>[]) => void }

export function ModeMapPalette({ onAdd, onAddMany }: Props) {
  const [search, setSearch] = useState('');
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());
  const [customModes, setCustomModes] = useCustomModes();

  const q = normalizeQuery(search);
  const customList = matchCustomModes(Array.isArray(customModes) ? customModes : [], q);

  const toggleGroup = (id: string) => setOpenGroups(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const groups = SORTED_GROUPS.flatMap(group => {
    const meta = GROUP_TO_TYPE[group.id];
    const found = matchGroupItems(group, q);
    if (!meta || (q && found.length === 0)) return [];
    const items: PaletteGroupItem[] = found.map(i => ({
      id: i.id, name: i.name, title: i.short,
      draft: () => makeModeNode(i.id, meta.type, i.name, meta.copingSubtype ? { copingSubtype: meta.copingSubtype } : {}),
    }));
    const art = <GuideSignArt sign={modeGroupSign(group.id)} size="row" />; // тот же знак, что у листа режима в подсказках
    return [{ id: group.id, title: group.group, color: meta.color, art, total: group.items.length, items }];
  });
  const domains = SCHEMA_DOMAINS.flatMap((d, i) => {
    const found = matchDomainSchemas(d, q);
    if (q && found.length === 0) return [];
    const items: PaletteGroupItem[] = found.map(s => ({
      id: s.id, name: s.name, title: s.desc,
      draft: () => schemaNode(s.id, s.name, d.color),
    }));
    const art = <DomainArt domain={i + 1} size="row" />; // номер домена — порядок SCHEMA_DOMAINS, как в DomainMark
    return [{ id: domainKey(d.id), title: d.domain, color: d.color, art, total: d.schemas.length, items }];
  });

  const showTrigger = matchesTrigger(q);
  const showBehavior = matchesBehavior(q);
  const modesVisible = !q || groups.length > 0 || customList.length > 0;
  const schemasVisible = !q || domains.length > 0;
  const figuresVisible = !q || showTrigger || showBehavior;
  const nothing = !modesVisible && !schemasVisible && !figuresVisible;

  const group = (g: (typeof groups)[number]) => (
    <PaletteGroup key={g.id} {...g} open={openGroups.has(g.id)} searching={!!q} onToggle={toggleGroup} onAdd={onAdd} />
  );

  return (
    <div className="ds-card mm2-pal">
      <div className="mm2-pal-search">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Режим или схема…" className="ds-input ds-input--search" />
      </div>

      <div className="mm2-pal-scroll">
        {modesVisible && <h3 className="mm2-pal-block">Режимы</h3>}
        {!q && <ClientModesPalette onAdd={onAdd} onAddMany={onAddMany} onDragStart={startNodeDrag} />}
        {groups.map(group)}
        <CustomModesPalette state={customModes} setState={setCustomModes} list={customList} searching={!!q} onAdd={onAdd} onDragStart={startNodeDrag} />

        {schemasVisible && <h3 className="mm2-pal-block">Схемы</h3>}
        {!q && <ClientSchemasPalette onAdd={onAdd} onDragStart={startNodeDrag} />}
        {domains.map(group)}

        {figuresVisible && <h3 className="mm2-pal-block">Фигуры</h3>}
        {showTrigger && (
          <button onClick={() => onAdd({ id: `trigger_${Date.now()}`, type: 'trigger', data: { label: 'Триггер' } })}
            draggable onDragStart={e => startNodeDrag(e, { id: `trigger_${Date.now()}`, type: 'trigger', data: { label: 'Триггер' } })}
            className="mm2-pal-item is-lg" title="Внешняя ситуация, запускающая цикл" aria-label="Внешняя ситуация, запускающая цикл">
            <IdentityDot color={TYPE_COLORS.trigger} size={12} />
            <span className="mm2-pal-item-name">Триггер / Ситуация</span>
          </button>
        )}
        {showBehavior && (
          <button onClick={() => onAdd({ id: `behavior_${Date.now()}`, type: 'behavior', data: { label: 'Поведение' } })}
            draggable onDragStart={e => startNodeDrag(e, { id: `behavior_${Date.now()}`, type: 'behavior', data: { label: 'Поведение' } })}
            className="mm2-pal-item is-lg" title="Что человек делает / последствие" aria-label="Что человек делает / последствие">
            <IdentityDot color={TYPE_COLORS.behavior} size={12} />
            <span className="mm2-pal-item-name">Поведение / Последствие</span>
          </button>
        )}
        {!q && <ConceptPaletteItems onAdd={onAdd} onDragStart={startNodeDrag} />}

        {nothing && <p className="ds-empty mm2-pal-empty">Ничего не найдено</p>}
      </div>
    </div>
  );
}
