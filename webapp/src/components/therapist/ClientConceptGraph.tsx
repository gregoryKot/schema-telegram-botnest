import { useRef, useState, type ReactNode } from 'react';
import { api } from '../../api';
import { ConceptGraph } from '../../../../shared/src/therapy/conceptGraph/ConceptGraph';
import type { ClientDetail } from './clientSheetTypes';
import { useClientConceptGraph } from './useClientConceptGraph';
import { ConceptGraphToolbar } from './ConceptGraphToolbar';
import { ConceptFullscreenSheet } from './ConceptFullscreenSheet';
import { ConceptTabHead, type ConceptTabHeadProps } from './concept/ConceptTabHead';
import type { AssignPreset } from './assignTemplates';
import { useConceptGuide } from './guide/useConceptGuide';

// Вид «Схема»: схема случая в потоке или, по «На весь экран», в листе; данные и правки —
// useClientConceptGraph, одни на оба места. Действия (картинка, весь экран, холст) в потоке уходят
// в меню шапки (head рисуется здесь ради graph), в листе — панель. Сводка digest (#902) — под шапкой.
// Подсказки терапевту (#995): листы режима и техники — после схемы, «Дать заданием» — onAssign,
// история «давали …» — по заданиям клиента, «Делали сегодня» — правкой связей графа.
export function ClientConceptGraph({ detail, onOpenCanvas, onAssign, head, digest }: {
  detail: ClientDetail;
  onOpenCanvas?: (mapId: number) => void;
  onAssign?: (preset: AssignPreset) => void;
  head: Omit<ConceptTabHeadProps, 'graph'>;
  digest?: ReactNode;
}) {
  // Высота схемы в потоке, пока открыт лист (null — лист закрыт). Место держится
  // пустым, чтобы страница под листом не схлопнулась и после «Свернуть» не уехал скролл.
  const [held, setHeld] = useState<number | null>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<(() => void) | null>(null);
  const g = useClientConceptGraph(detail, graphRef, onOpenCanvas && ((id) => { backRef.current?.(); onOpenCanvas(id); }));
  const guide = useConceptGuide({ onAssign, tasks: detail.clientTasks, graph: g.graphProps });
  const expand = () => {
    api.trackEvent('concept_graph_fullscreen');
    setHeld(flowRef.current?.offsetHeight ?? 0);
  };
  const graph = (
    <div ref={graphRef} className="tcp-graph"><ConceptGraph {...g.graphProps} guide={guide.actions} /></div>
  );
  return (
    <>
      <ConceptTabHead {...head} graph={{ image: g.image, canvas: g.canvas, expand }} />
      {digest}
      {held !== null ? (
        <>
          <div aria-hidden style={{ height: held }} />
          <ConceptFullscreenSheet
            title="Схема случая" closeLabel="Свернуть" onClose={() => setHeld(null)} backRef={backRef}
            toolbar={<ConceptGraphToolbar image={g.image} canvas={g.canvas} />}
          >
            {graph}
          </ConceptFullscreenSheet>
        </>
      ) : (
        <div ref={flowRef} style={{ minWidth: 0 }}>{graph}</div>
      )}
      {guide.sheets}
    </>
  );
}
