import { useEffect, useState } from 'react';

// Строка диагностики в «О приложении»: какой версии запущенное приложение и
// стоит ли офлайн-кеш (service worker). Родилась из недели отладки скорости
// PWA (2026-08-25): владелец и стенд смотрели на разные версии, не имея
// способа это заметить, — один скриншот настроек теперь отвечает на оба
// вопроса.
//
// Дату версии даёт document.lastModified — браузер берёт её из HTTP-заголовка
// Last-Modified у index.html (mtime файла в образе = момент сборки деплоя).
// Зашить время в бандл нельзя: dist закоммичен, CI сверяет его с пересборкой
// байт-в-байт, и любой new Date() времени сборки роняет джобу miniapp
// (поймано на PR #431).

function versionLabel(): string {
  const d = new Date(document.lastModified);
  if (Number.isNaN(d.getTime())) return 'неизвестно';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm} ${hh}:${mi}`;
}

export function BuildInfoLine() {
  const [sw, setSw] = useState<'checking' | 'on' | 'off'>('checking');

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      setSw('off');
      return;
    }
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => setSw(regs.length > 0 ? 'on' : 'off'))
      .catch((e) => {
        console.error('sw status check failed', e);
        setSw('off');
      });
  }, []);

  return (
    <div
      style={{
        fontSize: 11,
        color: 'var(--text-faint)',
        lineHeight: 1.5,
        marginTop: 6,
      }}
    >
      Версия от {versionLabel()} · офлайн-кеш:{' '}
      {sw === 'checking' ? '…' : sw === 'on' ? 'стоит' : 'снят'}
    </div>
  );
}
