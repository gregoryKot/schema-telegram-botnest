import { useState } from 'react';
import { api, reportClientError } from '../../api';
import { useTr } from '../../utils/addressForm';
import { useCopyToClipboard } from '../../../../shared/src/utils/useCopyToClipboard';
import { botShortUrl } from '../../utils/botConfig';
import { ShareCardSheet } from '../../share/ShareCardSheet';
import { appInviteShare } from '../../../../shared/src/share/cards/inviteShare';
import { SSection, SRow } from './ui';
import { ExportSummaryModal } from './ExportSummaryModal';
import { AboutSheet } from './AboutSheet';

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
    try { if (navigator.share) { await navigator.share({ text }); shared = true; } }
    catch (e) { // отказ от системного шаринга (AbortError) — штатный путь, текст ниже копируется сам
      if (!(e instanceof Error && e.name === 'AbortError')) reportClientError({ message: `settings export share failed: ${String(e)}`, section: 'settings' });
    }
    if (!shared) { await exportAutoCopy.copy(text); setExportText(text); }
  }

  return (
    <>
      <SSection id="s-share" label="Поделиться">
        <SRow title="Пригласить друга" sub="Карточка со ссылкой на бота" onClick={() => setAppInvite(true)} />
        <SRow title="Сводка для терапевта" sub="Данные за 30 дней" onClick={openExport} />
        {exportError && <div className="st-err">{tr('Не удалось собрать сводку. Проверь связь и попробуй ещё раз', 'Не удалось собрать сводку. Проверьте связь и попробуйте ещё раз')}</div>}
      </SSection>
      {appInvite && <ShareCardSheet {...appInviteShare(botShortUrl)} onClose={() => setAppInvite(false)} zIndex={400} />}
      {exportText && <ExportSummaryModal text={exportText} onClose={() => setExportText(null)} />}
    </>
  );
}

// Раздел «О приложении»: одна строка, как в мини-аппе. Длинный текст («зачем
// это всё», пять потребностей, ссылки) — в отдельном листе по нажатию.
export function AboutSection() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <section id="s-about" className="ds-card st-section">
        <SRow title="О приложении" sub="Зачем это всё, пять потребностей, об авторе" onClick={() => setOpen(true)} />
      </section>
      {open && <AboutSheet onClose={() => setOpen(false)} />}
    </>
  );
}
