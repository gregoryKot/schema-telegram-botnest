import type { RefObject } from 'react';
import type { ModeMapNode } from '../../api';
import { NEED_ORDER, getNeedData } from '../../needData';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { useTr } from '../../utils/addressForm';
import { MODE_MAP_NODE_TEXT_MAX } from '../../../../shared/src/limits/textLimits';
import { ModeSchemasField, SchemaOptions } from './ModeSchemasField';
import { pickNeed, pickSchema } from './identityPick';

// Смысловые поля панели фигуры по её типу (вынесено из ModeMapNodeEditor.tsx):
// вверху — чем фигура является (какая схема, какая потребность, как заполнять
// круг), внизу — связи режима (схемы, потребность, ответ Здорового Взрослого).

type Data = ModeMapNode['data'];
type Patch = (d: Partial<Data>) => void;
/** Достройка круга потребностей: сколько из пяти не хватает внутри и чем их поставить. */
export interface HubFill { missing: number; fill: () => void }

const NEEDS = getNeedData('ty'); // названия потребностей одинаковы в обеих формах
const CORE_NEEDS = NEED_ORDER.map(id => NEEDS[id]?.name).filter(Boolean) as string[];
const MODES = new Set<ModeMapNode['type']>(['child', 'critic', 'coping', 'healthy', 'custom', 'trigger', 'behavior']);

function HubHowTo({ hub }: { hub?: HubFill }) {
  const tr = useTr();
  return (
    <div className="mm2-hint">
      <div className="ds-label">Как заполнять</div>
      <p className="mm2-hint-p">Внутри — пять базовых потребностей, они двигаются вместе с кругом.</p>
      <p className="mm2-hint-p">{tr(
        'Какая потребность не удовлетворялась — проведи к ней линию от схемы и выбери «✗ блокирует». Кто о ней заботится — линия «✓» от Здорового Взрослого.',
        'Какая потребность не удовлетворялась — проведите к ней линию от схемы и выберите «✗ блокирует». Кто о ней заботится — линия «✓» от Здорового Взрослого.')}</p>
      {hub && hub.missing > 0 && (
        <button onClick={hub.fill} className="ds-btn ds-btn--secondary mm2-hint-btn">
          {hub.missing === 5 ? 'Поставить пять потребностей' : `Добавить недостающие (${hub.missing})`}
        </button>
      )}
    </div>
  );
}

/** Верх панели: чем является фигура схемы случая. У режимов, триггера и поведения пусто. */
export function NodeIdentityField({ node, patchData, hub }: { node: ModeMapNode; patchData: Patch; hub?: HubFill }) {
  const d = node.data;
  if (node.type === 'needs') return <HubHowTo hub={hub} />;
  if (node.type === 'schema') return (
    <>
      <label className="ds-label" htmlFor="mm-node-which-schema">Какая это схема</label>
      <select id="mm-node-which-schema" className="ds-input" value={d.schemaId ?? ''} onChange={e => patchData(pickSchema(d, e.target.value))}>
        <option value="">— выбрать —</option>
        <SchemaOptions />
      </select>
    </>
  );
  if (node.type !== 'need') return null;
  return (
    <>
      <div className="ds-label" id="mm-need-pick">Какая потребность</div>
      <div className="mm2-chips mm2-dot-chips" role="group" aria-labelledby="mm-need-pick">
        {NEED_ORDER.map(id => (
          <button key={id} onClick={() => patchData(pickNeed(d, id))} aria-pressed={d.needId === id}
            className={`mm2-chip is-sm${d.needId === id ? ' is-active' : ''}`}>
            <IdentityDot id={id} size={7} /> {NEEDS[id]?.name}
          </button>
        ))}
      </div>
    </>
  );
}

/** Низ панели: связи фигуры — схемы режима, схема опыта, потребность, ответ Здорового Взрослого. */
export function NodeMeaningFields({ node, patchData, needRef, healthyRef }: {
  node: ModeMapNode; patchData: Patch;
  needRef: RefObject<HTMLInputElement | null>; healthyRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const tr = useTr();
  const { type, data } = node;
  return (
    <>
      {MODES.has(type) && <ModeSchemasField data={data} patchData={patchData} />}

      {type === 'origin' && (
        <>
          <label className="ds-label" htmlFor="mm-node-origin-schema">К какой схеме относится</label>
          <select id="mm-node-origin-schema" className="ds-input" value={data.schemaId ?? ''}
            onChange={e => patchData({ schemaId: e.target.value || undefined })}>
            <option value="">— не выбрана —</option>
            <SchemaOptions />
          </select>
        </>
      )}

      {(type === 'child' || type === 'custom') && (
        <>
          <label className="ds-label" htmlFor="mm-node-need">Неудовлетворённая потребность</label>
          <input id="mm-node-need" ref={needRef} className="ds-input" list="modemap-needs" value={data.unmetNeed ?? ''} maxLength={MODE_MAP_NODE_TEXT_MAX}
            onChange={e => patchData({ unmetNeed: e.target.value || undefined })}
            placeholder={tr('Выбери или впиши свою…', 'Выберите или впишите свою…')} />
          <datalist id="modemap-needs">
            {CORE_NEEDS.map(n => <option key={n} value={n} />)}
          </datalist>
        </>
      )}

      {(type === 'child' || type === 'critic' || type === 'coping') && (
        <>
          <label className="ds-label is-ok" htmlFor="mm-node-healthy">Что сказал бы Здоровый Взрослый</label>
          <textarea id="mm-node-healthy" ref={healthyRef} className="ds-textarea is-ok" style={{ minHeight: 48 }} rows={2} maxLength={MODE_MAP_NODE_TEXT_MAX}
            value={data.healthyResponse ?? ''} onChange={e => patchData({ healthyResponse: e.target.value || undefined })}
            placeholder={type === 'critic' ? tr('Ответ критику: «От тебя не требуется безупречность…»', 'Ответ критику: «От вас не требуется безупречность…»')
              : type === 'coping' ? 'Зачем защита? «Я могу выдержать эту боль…»'
              : tr('Поддержка ребёнку: «Я с тобой, ты в безопасности…»', 'Поддержка ребёнку: «Я с тобой, ты в безопасности…»')} />
        </>
      )}
    </>
  );
}
