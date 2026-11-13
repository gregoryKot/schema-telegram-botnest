// Тихая ссылка «Поделиться» (иконка и слово) — там, где шаринг не главное действие: карточка схемы,
// раскрытая строка режима справочника. Одна на сайт (ревью g5 r1: две ручные копии разметки); крупная
// иконка-кнопка — SharePillButton рядом. aria-label — когда слово не называет, чем делятся; label — своё слово.
import { ShareIcon } from '../../../shared/src/share/ShareIcon';
import './share-link.css';

export function ShareLink({ onClick, ariaLabel, label = 'Поделиться' }: { onClick: () => void; ariaLabel?: string; label?: string }) {
  return (
    <button type="button" className="ds-link ss-share-link" aria-label={ariaLabel} onClick={onClick}>
      <ShareIcon /> {label}
    </button>
  );
}
