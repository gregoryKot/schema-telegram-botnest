// Лист «О приложении» — паритет с мини-аппом (AboutSheet): «зачем это всё»,
// пять потребностей (общий текст, shared/about/aboutData), что за инструмент и
// куда написать. Открывается строкой в настройках, а не раскрыт в списке.
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { BottomSheetShell } from '../BottomSheetShell';
import { ExternalLink } from '../../host/ExternalLink';
import { AboutWhy } from './AboutWhy';
import '../../styles/sheet-settings.css';

export function AboutSheet({ onClose }: { onClose: () => void }) {
  const goBack = useHistorySheet(onClose);
  return (
    <BottomSheetShell goBack={goBack} zIndex={400} label="О приложении">
      <h2 className="ds-h3">Зачем это всё</h2>
      <AboutWhy />
      <div className="st-body-block">
        <p className="st-text">
          Инструмент самопознания на основе схема-терапии: трекер потребностей, дневники схем и режимов, тесты, практики и пространство для работы с терапевтом.
        </p>
        <div className="st-links">
          <ExternalLink href="https://t.me/SchemeHappens">Канал о схема-терапии → <b>@SchemeHappens</b></ExternalLink>
          <ExternalLink href="https://t.me/kotlarewski">Записаться на сессию → <b>@kotlarewski</b></ExternalLink>
          {/* Подписка скрыта до подключения рекуррента у Robokassa — вернуть ссылку на /subscribe, когда заработает */}
          <ExternalLink href="/donate">Поддержать проект → <b>разовый донат</b></ExternalLink>
        </div>
        <div className="st-fine">Это образовательный инструмент — не медицинский и не психологический сервис.</div>
      </div>
      <button type="button" className="ds-btn st-done" onClick={goBack}>Закрыть</button>
    </BottomSheetShell>
  );
}
