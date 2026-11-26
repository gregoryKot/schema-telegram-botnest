// Полоса одной потребности в листе «Мой портрет»: знак потребности (NeedArt по ключу need_*), имя,
// полоса цветом данных (needDataColor — палитра данных, решение 7), число рядом: смысл не держится
// на цвете одном. Эмодзи 🤝🧭💬🎉⚖️ ушли вместе с синей и фиолетовой заливкой (b21).
import type { PortraitNeed } from '../../../../shared/src/portrait/portraitData';
import type { SignKey } from '../../../../shared/src/theme/entityLook';
import { SignArt } from '../../components/art/SignArt';
import { needDataStyle } from '../../components/needDataColor';

export function PortraitNeedBar({ n, maxCount }: { n: PortraitNeed; maxCount: number }) {
  return (
    <div className="cpf-bar" style={needDataStyle(n.id)}>
      <div className="cpf-bar-name">
        <span className="cpf-bar-sign" aria-hidden="true"><SignArt sign={`need_${n.id}` as SignKey} size="row" /></span>
        <span>{n.label}</span>
      </div>
      <div className="cpf-bar-track">
        <div className="cpf-bar-fill" style={{ width: `${(n.count / maxCount) * 100}%` }} />
      </div>
      <div className={`cpf-bar-n${n.count > 0 ? '' : ' is-zero'}`}>{n.count}</div>
    </div>
  );
}
