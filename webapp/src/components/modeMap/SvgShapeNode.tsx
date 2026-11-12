import { useLayoutEffect, useRef, useState } from 'react';
import { scalePath } from '../../../../shared/src/modeMap/modeShapes';
import type { ModeNodeData } from './nodeStyle';
import { nodePaper } from './nodePaper';
import { AllHandles, NodeLabel, NodeTools, SideBadge } from './nodeParts';

interface Props {
  id: string; type: string; data: ModeNodeData; selected?: boolean;
  /** Контур в пространстве viewBox (растягивается под фигуру) или построитель по пиксельному размеру. */
  shape: string | ((w: number, h: number) => string);
  viewBox?: [number, number];
  /** Класс размеров и отступов текста от скошенных краёв (styles/modemap-paper.css). */
  pad: string;
}

/**
 * Фигура по контуру: коробка облегает текст, контур (SVG) строится 1:1 в её пикселях — обводка
 * одной толщины со всех сторон, текст всегда внутри. Тень — тот же контур сдвинутым слоем под лицом.
 */
export function SvgShapeNode({ id, type, data, selected, shape, viewBox = [100, 100], pad }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setSize({ w: el.offsetWidth, h: el.offsetHeight }); // замер до отрисовки: без мигания
    const ro = new ResizeObserver(() => setSize({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [bw, bh] = viewBox;
  const ready = size.w > 0 && size.h > 0;
  const [w, h] = ready ? [size.w, size.h] : [bw, bh];
  const d = typeof shape === 'function' ? shape(w, h) : scalePath(shape, w / bw, h / bh);
  const paper = nodePaper(type, data, selected, `mm2-n--svg ${pad}`);

  return (
    <div ref={ref} className={paper.className} style={paper.style}>
      <NodeTools id={id} selected={selected} data={data} />
      <SideBadge side={data.side} />
      <AllHandles />
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mm2-n-svg">
        {/* Цвета и сдвиг тени — атрибутами готовых значений: экспорт картинкой не видит классов и var() в SVG (nodePaper.ts). */}
        <path d={d} className="mm2-n-shade" fill={paper.ink.shade} transform="translate(3 4)" />
        <path d={d} fill={paper.ink.fill} stroke={paper.ink.line} strokeWidth={paper.stroke}
          strokeLinejoin="round" strokeLinecap="round" shapeRendering="geometricPrecision" />
      </svg>
      <div className="mm2-n-text"><NodeLabel id={id} data={data} light={!!data.fillFull} /></div>
    </div>
  );
}
