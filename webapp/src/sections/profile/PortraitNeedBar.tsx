// Полоса одной потребности в портрете — общая для карточки профиля и строк
// листа «Мой портрет» (одна механика — один компонент). Число рядом с
// полосой дублирует длину словами: смысл не держится на цвете одном.
import type { PortraitNeed } from '../../../../shared/src/portrait/portraitData';

export function PortraitNeedBar({ n, maxCount }: { n: PortraitNeed; maxCount: number }) {
  return (
    <div className="cpf-bar">
      <div className="cpf-bar-name">
        <span aria-hidden>{n.emoji}</span>
        <span>{n.label}</span>
      </div>
      <div className="cpf-bar-track">
        <div className="cpf-bar-fill" style={{ width: `${(n.count / maxCount) * 100}%`, background: n.color }} />
      </div>
      <div className={`cpf-bar-n${n.count > 0 ? '' : ' is-zero'}`}>{n.count}</div>
    </div>
  );
}
