// Лист «О приложении»: «зачем это всё», пять потребностей (общий текст, shared/about/aboutData),
// что за инструмент и куда написать. Открывается строкой в настройках. Вид (b25): лист-рассказ на
// весь экран, герой — бумага со сценой колеса детства (пять полосок-потребностей вокруг круга),
// потребности — строки со знаком, ссылки — строки «подпись · адрес», оговорка мелкой строкой.
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useDialogA11y } from '../../../../shared/src/utils/dialogA11y';
import { ExternalLink } from '../../host/ExternalLink';
import { SceneChildhood } from '../art/LandingScenes';
import { hueStyle } from '../../lib/tone';
import { AboutWhy } from './AboutWhy';
import '../../styles/sheet-settings.css';

/** Бумага героя — оттенок сцены (SceneChildhood по умолчанию, песок). */
const HERO_HUE = 45;

const LINKS: { href: string; label: string; to: string }[] = [
  { href: 'https://t.me/SchemeHappens', label: 'Канал о схема-терапии', to: '@SchemeHappens' },
  { href: 'https://t.me/kotlarewski', label: 'Записаться на сессию', to: '@kotlarewski' },
  // Подписка скрыта до подключения рекуррента у Robokassa — вернуть ссылку на /subscribe, когда заработает
  { href: '/donate', label: 'Поддержать проект', to: 'разовый донат' },
];

export function AboutSheet({ onClose }: { onClose: () => void }) {
  const goBack = useHistorySheet(onClose);
  const dialogA11y = useDialogA11y();
  return (
    <div {...dialogA11y} className="u-sheet st-about" aria-label="О приложении">
      <div className="ds-sheet-head ds-sheet-head--page"><button type="button" className="ds-back" onClick={goBack}>← Закрыть</button></div>
      <div className="st-about-inner">
        <div className="pp-paper st-about-hero" style={hueStyle(HERO_HUE)}>
          <h1 className="st-about-title">Зачем это всё</h1>
          <div className="st-about-scene" aria-hidden="true"><SceneChildhood hue={HERO_HUE} /></div>
        </div>
        <AboutWhy />
        <p className="st-text">
          Инструмент самопознания на основе схема-терапии: трекер потребностей, дневники схем и режимов, тесты, практики и пространство для работы с терапевтом.
        </p>
        <div className="st-links">
          {LINKS.map(l => (
            <ExternalLink key={l.href} className="ds-list-row ds-list-row--nav ds-list-row--inset ds-list-row--hover" href={l.href}>
              <span className="ds-list-title">{l.label} </span>
              <span className="st-link-to">→ <b>{l.to}</b></span>
            </ExternalLink>
          ))}
        </div>
        <button type="button" className="ds-btn ds-btn--lg st-done" onClick={() => goBack()}>Закрыть</button>
        <div className="st-fine">Это образовательный инструмент — не медицинский и не психологический сервис.</div>
      </div>
    </div>
  );
}
