import { achievementCardLook } from '../../../../shared/src/share/kit/cardLook';
import { SignArt } from '../../components/art/SignArt';
import { hueStyle } from '../../lib/tone';

/** Значок достижения по ACHIEVEMENT_CARD_LOOK (один вид с карточками шаринга; серии и дни — числом фигур): знак на бумаге своего оттенка со сдвинутым сплошным слоем
 *  под ней (Lift — «бумага на бумаге», client-profile.css). Не получено — силуэт: тихая бумага,
 *  знак одним тоном, без слоя. Незнакомый id — ничего (без выдуманного знака). Декор: смысл несёт подпись. */
export function AchievementBadge({ id, earned }: { id: string; earned: boolean }) {
  const look = achievementCardLook(id);
  if (!look) return null;
  return (
    <span className={`cpf-badge ${earned ? 'is-earned' : 'is-locked'}`} style={hueStyle(look.hue)} aria-hidden="true" data-sign={look.sign}>
      <SignArt sign={look.sign} count={look.n} size="row" />
    </span>
  );
}
