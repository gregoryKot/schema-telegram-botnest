import type { ReactNode } from 'react';
import { hueStyle } from '../../lib/tone';

export interface ToneGroup {
  id: string;
  name: string;
  hue: number;
  items: { id: string; name: string }[];
}

interface Props {
  label: string;
  /** Правый слот шапки: счётчик («4 в работе») … */
  sub?: string;
  /** … или ссылка-действие («Редактировать →»). */
  action?: ReactNode;
  groups: ToneGroup[];
  /** Раскладка на компьютере (≥768): плитки (схемы) или колонки с верхней чертой (режимы). Телефон — строки. */
  layout: 'tiles' | 'cols';
}

// Карточка «Обзора» со строками по группам — домены схем, группы режимов
// (#906): подпись капителью, имя группы — ds-sub, элемент — точка тона +
// название. Цвет сущности только точкой: ни плиток с заливкой, ни цветных
// рамок, один акцент на экран. На компьютере (≥768) те же группы — плитки по
// три в ряд (схемы) и колонки (режимы), как в макете; тон — тонкая подложка и
// верхняя черта, не заливка (therapist-card.css).
export function ToneGroupsCard({ label, sub, action, groups, layout }: Props) {
  return (
    <section className="ds-card">
      <div className="ds-head-row tk-card-head">
        <h2 className="ds-label">{label}</h2>
        {sub && <span className="ds-sub">{sub}</span>}
        {action}
      </div>
      <div className={`tk-groups tk-groups--${layout}`}>
        {groups.map(g => (
          <div key={g.id} className="tk-group" style={hueStyle(g.hue)}>
            <div className="ds-sub">{g.name}</div>
            {g.items.map(i => (
              <div key={i.id} className="tk-item">
                <span className="ds-dot tone-fill" style={hueStyle(g.hue)} aria-hidden />
                {i.name}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
