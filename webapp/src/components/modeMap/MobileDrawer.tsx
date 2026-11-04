import type { ReactNode } from 'react';
import { useHistorySheet } from '../../hooks/useHistorySheet';

// Боковая шторка редактора карты на телефоне (палитра слева, правка узла и связи
// справа), поверх холста. Живёт в истории как лист: «Назад» браузера или Android
// закрывает шторку, а не уводит из карточки клиента (QA 2026-11, T-3). Все
// закрытия шторки идут через goBack, который получают и содержимое, и «ушко»:
// закрыл мимо него — запись истории осталась бы висеть.
export function MobileDrawer({ side, onClose, content, sideBtn }: {
  side: 'left' | 'right';
  onClose: () => void;
  content: (goBack: (then?: unknown) => void) => ReactNode;
  sideBtn?: (goBack: (then?: unknown) => void) => ReactNode;
}) {
  const goBack = useHistorySheet(onClose);
  const close = () => goBack();
  const body = content(goBack);
  const btn = sideBtn?.(goBack);
  return (
    <>
      <div role="button" tabIndex={0} aria-label="Закрыть" onClick={close}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); close(); } }}
        style={{ position: 'absolute', inset: 0, zIndex: 39, background: 'rgba(0,0,0,0.25)' }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, [side]: 0, zIndex: 40, display: 'flex',
        boxShadow: side === 'left' ? '4px 0 16px rgba(0,0,0,0.15)' : '-4px 0 16px rgba(0,0,0,0.15)' }}>
        {side === 'left' ? <>{body}{btn}</> : <>{btn}{body}</>}
      </div>
    </>
  );
}
