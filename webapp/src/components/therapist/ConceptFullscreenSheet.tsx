import { useEffect, type MutableRefObject, type ReactNode } from 'react';
import { useHistorySheet } from '../../hooks/useHistorySheet';

interface Props {
  /** Заголовок листа; он же имя диалога для ридера. */
  title: string;
  /** Кнопка закрытия: «Свернуть» у схемы (она остаётся в потоке), «Закрыть» у экрана «Главное». */
  closeLabel: string;
  onClose: () => void;
  /** Сюда лист кладёт свой goBack, пока открыт: им закрываются и действия вне листа (перенос на холст). */
  backRef?: MutableRefObject<(() => void) | null>;
  /** Панель действий в шапке (скачать картинкой, открыть на холсте). */
  toolbar?: ReactNode;
  /** Полоса под шапкой: подсказка и выбор блоков у «Главного». */
  sub?: ReactNode;
  children: ReactNode;
}

/**
 * Лист концептуализации на весь экран — один на схему случая, «Главное» и схему
 * у клиента (MyConceptSheet). В кабинете вокруг содержания стоят меню и список
 * клиентов, и на ноутбуке четыре колонки схемы в поток не помещаются; лист отдаёт всю
 * ширину окна, ничего не прячет в самом кабинете и закрывается кнопкой, Escape
 * или «Назад» браузера (useHistorySheet). Содержимое — то же, что в потоке, с
 * теми же обработчиками: правки сохраняются как в потоке.
 */
export function ConceptFullscreenSheet({ title, closeLabel, onClose, backRef, toolbar, sub, children }: Props) {
  const goBack = useHistorySheet(onClose);
  useEffect(() => {
    if (!backRef) return;
    backRef.current = goBack;
    return () => { backRef.current = null; };
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{ position: 'fixed', inset: 0, zIndex: 250, background: 'var(--bg)', display: 'flex', flexDirection: 'column', paddingTop: 'var(--safe-top)' }}
    >
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-12)',
        padding: 'var(--space-12) var(--space-20)', borderBottom: sub ? undefined : '1px solid var(--line)',
      }}>
        <h2 className="ds-h2" style={{ margin: 0, marginRight: 'auto' }}>{title}</h2>
        {toolbar}
        <button type="button" className="ds-btn ds-btn--secondary" onClick={goBack}>{closeLabel}</button>
      </div>
      {sub}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', overscrollBehavior: 'contain', padding: 'var(--space-20)' }}>
        {children}
      </div>
    </div>
  );
}
