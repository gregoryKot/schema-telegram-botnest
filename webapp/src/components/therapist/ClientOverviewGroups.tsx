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
}

// Карточка «Обзора» со строками по группам — домены схем, группы режимов
// (#906): подпись капителью, имя группы — ds-sub, элемент — точка тона +
// название. Цвет сущности только точкой: ни плиток с заливкой, ни цветных
// рамок, один акцент на экран.
export function ToneGroupsCard({ label, sub, action, groups }: Props) {
  return (
    <section className="ds-card">
      <div className="ds-head-row tk-card-head">
        <span className="ds-label">{label}</span>
        {sub && <span className="ds-sub">{sub}</span>}
        {action}
      </div>
      <div className="tk-groups">
        {groups.map(g => (
          <div key={g.id} className="tk-group">
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
