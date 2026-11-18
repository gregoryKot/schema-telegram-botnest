// Пометки «пером» страницы ссылок: галочка, стрелка-переход и стрелка к кнопке записи.
// Цвет — currentColor места.
import type { ReactNode } from 'react';

const pen = (w: number, h: number, d: string) => function Pen({ className }: { className?: string }): ReactNode {
  return (
    <svg className={className ? `lk-hand ${className}` : 'lk-hand'} width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
};

export const PenTick = pen(22, 20, 'M3 11c2 1.5 3.5 3.5 5 6C10.5 10.5 14 6 19 2.5');
export const PenGo = pen(27, 17, 'M2 9c7-2.5 14-2.5 22-.5M18 3c2.5 1.8 4.5 3.6 6 5.5-2.2 1.6-4.2 3.6-5.6 6');
export const PenCurve = pen(34, 24, 'M4 3c11 0 20 5 22 17M19 14.5c2.3 2 4.5 4 7 6 .8-3.2 1.8-6.2 3.4-9');
