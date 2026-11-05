import type { ReactNode } from 'react';
import '../../styles/therapist-tabs.css';

// Заголовок вкладки карточки клиента: h2 и подпись. Показывается на компьютере
// (≥768, как до волн #906); на телефоне h2 прячет CSS (имя вкладки уже наверху).
// className `tb-tab-title--desk` прячет на телефоне весь блок, если подписи там нет.
// Без значков у заголовка: картинка — крупный акцент, одна на экран (владелец 2026-11-05).
export function TabTitle({ title, className = '', children }: { title: string; className?: string; children?: ReactNode }) {
  return (
    <div className={`tb-tab-title ${className}`.trim()}>
      <h2 className="ds-h2 tb-tab-h">{title}</h2>
      {children}
    </div>
  );
}
