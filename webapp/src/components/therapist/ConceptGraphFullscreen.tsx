import { useEffect, type MutableRefObject, type ReactNode } from 'react';
import { useHistorySheet } from '../../hooks/useHistorySheet';

interface Props {
  onClose: () => void;
  /** Сюда лист кладёт свой goBack, пока открыт: им закрываются и действия вне листа (перенос на холст). */
  backRef: MutableRefObject<(() => void) | null>;
  /** Панель действий в шапке (скачать картинкой, открыть на холсте). */
  toolbar: ReactNode;
  children: ReactNode;
}

/**
 * Схема случая «на весь экран». В кабинете вокруг схемы стоят меню и список
 * клиентов, и на ноутбуке четыре колонки (режимы, схемы, круг потребностей,
 * Здоровый Взрослый) в поток не помещаются; лист отдаёт схеме всю ширину окна,
 * ничего не прячет в самом кабинете и закрывается «Свернуть», Escape или кнопкой
 * «Назад» браузера (useHistorySheet). Граф внутри — тот же ConceptGraph с теми же
 * обработчиками, правки сохраняются как в потоке.
 */
export function ConceptGraphFullscreen({ onClose, backRef, toolbar, children }: Props) {
  const goBack = useHistorySheet(onClose);
  useEffect(() => {
    backRef.current = goBack;
    return () => { backRef.current = null; };
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Схема случая"
      style={{ position: 'fixed', inset: 0, zIndex: 250, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-12)',
        padding: 'var(--space-12) var(--space-20)', borderBottom: '1px solid var(--line)',
      }}>
        <h2 className="ds-h2" style={{ margin: 0, marginRight: 'auto' }}>Схема случая</h2>
        {toolbar}
        <button type="button" className="ds-btn ds-btn--secondary" onClick={goBack}>Свернуть</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', overscrollBehavior: 'contain', padding: 'var(--space-20)' }}>
        {children}
      </div>
    </div>
  );
}
