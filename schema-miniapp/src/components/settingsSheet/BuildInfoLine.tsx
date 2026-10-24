import { useEffect, useRef, useState } from 'react';
import { isPerfHudEnabled, setPerfHudEnabled } from '../../utils/perfLog';

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
  // Пять тапов по строке подряд включают панель замеров скорости (PerfHud,
  // см. perfLog.ts). Скрытый тумблер для отладки с владельцем — обычному
  // пользователю панель не нужна и не видна.
  const [hudOn, setHudOn] = useState(isPerfHudEnabled);
  const tapsRef = useRef({ count: 0, last: 0 });
  const handleTap = () => {
    const t = Date.now();
    if (t - tapsRef.current.last > 2000) tapsRef.current.count = 0;
    tapsRef.current.last = t;
    tapsRef.current.count += 1;
    if (tapsRef.current.count >= 5) {
      tapsRef.current.count = 0;
      const next = !isPerfHudEnabled();
      setPerfHudEnabled(next);
      setHudOn(next);
    }
  };

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
    // Строка — информационная, а не интерактивная: onClick здесь лишь
    // скрытый счётчик тапов отладочного тумблера, клавиатурного/тач-аналога
    // ему не положено (образец — HeroCta.tsx).
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      onClick={handleTap}
      style={{
        fontSize: 11,
        color: 'var(--text-faint)',
        lineHeight: 1.5,
        marginTop: 6,
      }}
    >
      Версия от {versionLabel()} · офлайн-кеш:{' '}
      {sw === 'checking' ? '…' : sw === 'on' ? 'стоит' : 'снят'}
      {hudOn ? ' · замеры: вкл' : ''}
    </div>
  );
}
