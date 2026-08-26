import { useEffect, useState } from 'react';

// Строка диагностики в «О приложении»: когда собрана запущенная версия и
// стоит ли офлайн-кеш (service worker). Родилась из недели отладки скорости
// PWA (2026-08-25): владелец и стенд смотрели на разные версии, не имея
// способа это заметить, — один скриншот настроек теперь отвечает на оба
// вопроса. __BUILD_AT__ подставляет сборка (vite define), в тестах его нет —
// компонент честно пишет «дев-режим», а не падает.
declare const __BUILD_AT__: string | undefined;

function buildLabel(): string {
  try {
    if (typeof __BUILD_AT__ !== 'string') return 'дев-режим';
    const d = new Date(__BUILD_AT__);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}.${mm} ${hh}:${mi}`;
  } catch {
    return 'дев-режим';
  }
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
      Сборка от {buildLabel()} · офлайн-кеш:{' '}
      {sw === 'checking' ? '…' : sw === 'on' ? 'стоит' : 'снят'}
    </div>
  );
}
