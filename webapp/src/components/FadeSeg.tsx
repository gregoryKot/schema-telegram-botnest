import { useEffect, type ReactNode } from 'react';
import { useStripEdges } from './history/dayStrip';
import { scrollIntoViewSafe } from '../../../shared/src/utils/scrollIntoView';

interface Props {
  /** Меняется вместе с выбранным пунктом и составом ленты: край пересчитывается, выбранный доводится до видимого. */
  watch: unknown;
  role: 'group' | 'tablist';
  label: string;
  className?: string;
  children: ReactNode;
}

/**
 * Прокручиваемый сегмент (.ds-seg--scroll), который не режет пункт по букве: край, за которым есть ещё
 * пункты, затухает (маска .ds-seg--fade в cabinet.css, механика полосы дат истории — useStripEdges),
 * а выбранный пункт (aria-pressed / aria-selected) доводится до видимого. Лента карт над холстом
 * (modeMap/MapTabs) и вкладки «Справочника» терапевта.
 */
export function FadeSeg({ watch, role, label, className, children }: Props) {
  const { ref, edges, measure } = useStripEdges(0);
  useEffect(() => {
    scrollIntoViewSafe(ref.current?.querySelector('[aria-pressed="true"], [aria-selected="true"]'), { block: 'nearest', inline: 'nearest' });
    measure();
  }, [watch, ref, measure]);
  return (
    <div ref={ref} onScroll={measure} role={role} aria-label={label}
      className={`ds-seg ds-seg--scroll ds-seg--fade${className ? ` ${className}` : ''}`}
      data-fade-start={edges.start ? '' : undefined} data-fade-end={edges.end ? '' : undefined}>
      {children}
    </div>
  );
}
