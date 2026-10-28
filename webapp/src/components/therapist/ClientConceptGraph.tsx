import { useRef, useState } from 'react';
import { api } from '../../api';
import { ConceptGraph } from '../../../../shared/src/therapy/conceptGraph/ConceptGraph';
import type { ClientDetail } from './clientSheetTypes';
import { useClientConceptGraph } from './useClientConceptGraph';
import { ConceptGraphToolbar } from './ConceptGraphToolbar';
import { ConceptGraphFullscreen } from './ConceptGraphFullscreen';
import { ConceptTabHead, type ConceptTabHeadProps } from './concept/ConceptTabHead';

// Вид «Схема»: схема случая в потоке или, по «На весь экран», в листе; данные и
// правки — useClientConceptGraph, одни на оба места. Действия (картинка, весь экран,
// холст) в потоке уходят в меню шапки (head рисуется здесь ради graph), в листе — панель.
export function ClientConceptGraph({ detail, onOpenCanvas, head }: {
  detail: ClientDetail;
  onOpenCanvas?: (mapId: number) => void;
  head: Omit<ConceptTabHeadProps, 'graph'>;
}) {
  // Высота схемы в потоке, пока открыт лист (null — лист закрыт). Место держится
  // пустым, чтобы страница под листом не схлопнулась и после «Свернуть» не уехал скролл.
  const [held, setHeld] = useState<number | null>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<(() => void) | null>(null);
  const g = useClientConceptGraph(detail, graphRef, onOpenCanvas && ((id) => { backRef.current?.(); onOpenCanvas(id); }));
  const expand = () => {
    api.trackEvent('concept_graph_fullscreen');
    setHeld(flowRef.current?.offsetHeight ?? 0);
  };
  const graph = (
    <div ref={graphRef} className="tcp-graph">
      <ConceptGraph {...g.graphProps} />
    </div>
  );
  return (
    <>
      <ConceptTabHead {...head} graph={{ image: g.image, canvas: g.canvas, expand }} />
      {held !== null ? (
        <>
          <div aria-hidden style={{ height: held }} />
          <ConceptGraphFullscreen
            onClose={() => setHeld(null)}
            backRef={backRef}
            toolbar={<ConceptGraphToolbar image={g.image} canvas={g.canvas} />}
          >
            {graph}
          </ConceptGraphFullscreen>
        </>
      ) : (
        <div ref={flowRef} style={{ minWidth: 0 }}>{graph}</div>
      )}
    </>
  );
}
