import type { Achievement } from '../../api';
import { pressable } from '../../utils/a11y';
import { SignArt } from '../../components/art/SignArt';
import { BLOCK_META } from '../../../../shared/src/screens/screenBlocks';
import { ACHIEVEMENT_META } from './profileMeta';
import { AchievementBadge } from './AchievementBadge';
interface Props { achievements: Achievement[]; onOpen: () => void }

/** «Достижения» в профиле: значки по ACHIEVEMENT_LOOK (полученные — бумага своего оттенка, остальные —
 *  силуэтом), весь блок открывает список. Телефон: полученные значками, остальные — строкой «ещё N» (css). */
export function AchievementsCard({ achievements, onOpen }: Props) {
  const earned = achievements.filter(a => a.earned).length;
  const rest = achievements.filter(a => !a.earned && ACHIEVEMENT_META[a.id]).length;
  return (
    <section {...pressable(onOpen)} className="cpf-sec cpf-sec--btn">
      <div className="ds-head-row">
        <span className="cpf-title">
          <span className="pp-row-art" aria-hidden="true"><SignArt sign={BLOCK_META.achievements?.sign ?? 'leaf'} size="row" /></span>
          <h2 className="ds-h3">Достижения</h2>
        </span>
        <span className="ds-sub">{earned} из {achievements.length} <span className="ds-chev" aria-hidden="true" /></span>
      </div>
      {earned === 0 && <div className="ds-sub">Первое – за первую запись в дневник</div>}
      <div className="cpf-ach-grid">
        {achievements.map(a => {
          const m = ACHIEVEMENT_META[a.id];
          if (!m) return null;
          return (
            <div key={a.id} className={`cpf-ach${a.earned ? ' is-earned' : ''}`}>
              <AchievementBadge id={a.id} earned={a.earned} />
              <span className="cpf-ach-text">
                <span className="cpf-ach-title">{m.title}</span>
                <span className="cpf-ach-desc">{m.desc}</span>
              </span>
            </div>
          );
        })}
        {rest > 0 && <div className="cpf-ach-more">ещё {rest}</div>}
      </div>
    </section>
  );
}
