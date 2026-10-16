import { useState } from 'react';
import { api } from '../../api';
import { useTr } from '../../utils/addressForm';
import { useCopyToClipboard } from '../../../../shared/src/utils/useCopyToClipboard';
import { botShortUrl } from '../../utils/botConfig';
import { ShareCardSheet } from '../../share/ShareCardSheet';
import { appInviteShare } from '../../../../shared/src/share/cards/inviteShare';
import { SSection, SRow } from './ui';
import { ExportSummaryModal } from './ExportSummaryModal';

// Раздел «Поделиться»: карточка-приглашение и сводка для терапевта.
export function ShareSection() {
  const tr = useTr();
  const [exportText, setExportText] = useState<string | null>(null);
  // Сводка собирается на сервере: сеть может отвалиться. Без этого состояния
  // отказ выглядел как «ничего не произошло».
  const [exportError, setExportError] = useState(false);
  const [appInvite, setAppInvite] = useState(false);
  // Авто-копия при открытии сводки — свой инстанс: иначе она подсвечивала бы
  // кнопку «Скопировать» в модалке, которую человек ещё не нажимал.
  const exportAutoCopy = useCopyToClipboard();

  async function openExport() {
    setExportError(false);
    let text: string;
    try {
      ({ text } = await api.getExport());
    } catch {
      setExportError(true);
      return;
    }
    let shared = false;
    try { if (navigator.share) { await navigator.share({ text }); shared = true; } } catch { /* best-effort: ошибку намеренно игнорируем */ }
    if (!shared) { await exportAutoCopy.copy(text); setExportText(text); }
  }

  return (
    <>
      <SSection id="s-share" label="Поделиться">
        <SRow title="Пригласить друга" sub="Карточка со ссылкой на бота" onClick={() => setAppInvite(true)} />
        <SRow title="Сводка для терапевта" sub="Данные за 30 дней" onClick={openExport} />
        {exportError && (
          <div className="st-err">
            {tr('Не удалось собрать сводку. Проверь связь и попробуй ещё раз', 'Не удалось собрать сводку. Проверьте связь и попробуйте ещё раз')}
          </div>
        )}
      </SSection>
      {appInvite && <ShareCardSheet {...appInviteShare(botShortUrl)} onClose={() => setAppInvite(false)} zIndex={400} />}
      {exportText && <ExportSummaryModal text={exportText} onClose={() => setExportText(null)} />}
    </>
  );
}

// Раздел «О приложении».
export function AboutSection() {
  return (
    <SSection id="s-about" label="О приложении">
      <div className="st-body-block">
        <p className="st-text">
          Инструмент самопознания на основе схема-терапии: трекер потребностей, дневники схем и режимов, тесты, практики и пространство для работы с терапевтом.
        </p>
        <div className="st-links">
          <a href="https://t.me/SchemeHappens" target="_blank" rel="noopener noreferrer">
            Канал о схема-терапии → <b>@SchemeHappens</b>
          </a>
          <a href="https://t.me/kotlarewski" target="_blank" rel="noopener noreferrer">
            Записаться на сессию → <b>@kotlarewski</b>
          </a>
          {/* Подписка скрыта до подключения рекуррента у Robokassa — вернуть ссылку на /subscribe, когда заработает */}
          <a href="/donate" target="_blank" rel="noopener noreferrer">
            Поддержать проект → <b>разовый донат</b>
          </a>
        </div>
        <div className="st-fine">
          Это образовательный инструмент — не медицинский и не психологический сервис.
        </div>
      </div>
    </SSection>
  );
}
