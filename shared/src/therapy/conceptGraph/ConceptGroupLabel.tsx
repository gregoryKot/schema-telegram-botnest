import type { CSSProperties, ReactNode } from 'react';
import { hueVar } from './conceptChipStyle';
import { useConceptSkin } from './conceptSkin';

/**
 * Заголовок группы чипов (домен схем, группа режимов): на сайте — ярлык
 * ds-label с точкой цвета, в мини-аппе — прежний инлайн `fallback`.
 */
export function ConceptGroupLabel({
  hue,
  fallback,
  children,
}: {
  hue: number;
  fallback: CSSProperties;
  children: ReactNode;
}) {
  const skin = useConceptSkin();
  if (!skin) return <div style={fallback}>{children}</div>;
  return (
    <div className={skin.label}>
      <span className={skin.dot} style={hueVar(hue)} />
      {children}
    </div>
  );
}
