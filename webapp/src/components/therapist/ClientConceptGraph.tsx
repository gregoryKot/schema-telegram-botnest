import { useRef, useState } from 'react';
import { api } from '../../api';
import { ConceptGraph } from '../../../../shared/src/therapy/conceptGraph/ConceptGraph';
import type { ClientDetail } from './clientSheetTypes';
import { useClientConceptGraph } from './useClientConceptGraph';
import { ConceptGraphToolbar } from './ConceptGraphToolbar';
import { ConceptGraphFullscreen } from './ConceptGraphFullscreen';

// Вид «Схема» вкладки концептуализации: схема случая (потребности в центре) в
// потоке кабинета или, по «На весь экран», в листе на всё окно. Данные и
// правки — useClientConceptGraph, одни на оба места. «Скачать картинкой»
// только здесь: мини-апп файл из WebView Telegram не скачивает. «Открыть на холсте» —
// тоже сайт (карты режимов в мини-аппе нет). Схеме нужна вся ширина (четыре
// колонки от 960px), поэтому ClientConceptTab в виде «Схема» не ставит боковую
// колонку рядом: сверка с YSQ и история версий уходят под схему.
export function ClientConceptGraph({ detail, onOpenCanvas }: { detail: ClientDetail; onOpenCanvas?: (mapId: number) => void }) {
  // Высота схемы в потоке, пока открыт лист (null — лист закрыт). Место держится
  // пустым, чтобы страница под листом не схлопнулась и после «Свернуть» не уехал скролл.
  const [held, setHeld] = useState<number | null>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<(() => void) | null>(null);
  const g = useClientConceptGraph(detail, graphRef, onOpenCanvas && ((id) => { backRef.current?.(); onOpenCanvas(id); }));
  const graph = (
    <div ref={graphRef} style={{ padding: 'var(--space-8)' }}>
      <ConceptGraph {...g.graphProps} />
    </div>
  );
  if (held !== null) {
    return (
      <>
        <div aria-hidden style={{ height: held }} />
        <ConceptGraphFullscreen
          onClose={() => setHeld(null)}
          backRef={backRef}
          toolbar={<ConceptGraphToolbar compact image={g.image} canvas={g.canvas} />}
        >
          {graph}
        </ConceptGraphFullscreen>
      </>
    );
  }
  const expand = () => {
    api.trackEvent('concept_graph_fullscreen');
    setHeld(flowRef.current?.offsetHeight ?? 0);
  };
  return (
    <div ref={flowRef} style={{ minWidth: 0 }}>
      <ConceptGraphToolbar image={g.image} canvas={g.canvas} onFullscreen={expand} />
      {graph}
    </div>
  );
}
