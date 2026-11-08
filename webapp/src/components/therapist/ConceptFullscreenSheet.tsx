import { useEffect, type MutableRefObject, type ReactNode } from 'react';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import '../../styles/concept-panel.css';

interface Props {
  /** Заголовок листа; он же имя диалога для ридера. */
  title: string;
  /** Кнопка закрытия: «Свернуть» у схемы (она остаётся в потоке), «Закрыть» у экрана «Главное». */
  closeLabel: string;
  onClose: () => void;
  /** Сюда лист кладёт свой goBack, пока открыт: им закрываются и действия вне листа (перенос на холст, «журнал →»). */
  backRef?: MutableRefObject<SheetBack | null>;
  /** Панель действий в шапке (скачать картинкой, открыть на холсте). */
  toolbar?: ReactNode;
  /** Полоса под шапкой: подсказка и выбор блоков у «Главного». */
  sub?: ReactNode;
  /** Колонка чтения (листы подсказок): шапка и содержимое одной ширины по центру — на компьютере не разъезжаются. */
  column?: number;
  /** Подпись в шапке вместо заголовка: заголовок рисует само содержимое (герой листа подсказок). */
  label?: string;
  /**
   * Панель справа на компьютере (листы подсказок, concept-panel.css): с 1024px лист ~600px во всю
   * высоту, слева виден затемнённый контекст, тап по затемнению — goBack; уже — весь экран.
   * Лист-панель поверх листа-панели ложится той же ширины поверх (техника из листа режима).
   */
  panel?: boolean;
  children: ReactNode;
}

/** goBack листа (useHistorySheet): закрыть лист и всё, что над ним; `then` — когда запись снята. */
export type SheetBack = (then?: () => void) => void;

/** Слой листов концептуализации; «Новое задание» из подсказок встаёт на него же, позже в DOM. */
export const CONCEPT_SHEET_Z = 250;

/**
 * Лист концептуализации на весь экран — один на схему случая («На весь экран»), экран
 * «Главное», листы подсказок терапевту (guide/) и схему у клиента (MyConceptSheet). В кабинете
 * вокруг содержания стоят меню и список клиентов, и на ноутбуке четыре колонки схемы в поток не
 * помещаются; лист отдаёт всю ширину окна, ничего не прячет в самом кабинете и закрывается
 * кнопкой, Escape или «Назад» браузера (useHistorySheet). Содержимое — то же, что в потоке, с
 * теми же обработчиками: правки сохраняются как в потоке. Листам подсказок вся ширина не нужна —
 * они встают панелью справа (`panel`), и терапевт видит, откуда открыл лист.
 */
export function ConceptFullscreenSheet({ title, closeLabel, onClose, backRef, toolbar, sub, column, label, panel, children }: Props) {
  const goBack = useHistorySheet(onClose);
  useEffect(() => {
    if (!backRef) return;
    backRef.current = goBack;
    return () => { backRef.current = null; };
  });

  // Отступы панели задаёт concept-panel.css (на компьютере шире), листа на весь экран — инлайн, как было.
  const content = (
    <>
      <div className="cfs-head" style={{
        padding: panel ? undefined : 'var(--space-12) var(--space-20)',
        borderBottom: sub || column ? undefined : '1px solid var(--line)',
      }}>
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-12)',
          ...(column && { maxWidth: column, margin: '0 auto' }),
        }}>
          {label
            ? <div className="ds-label" style={{ marginRight: 'auto' }}>{label}</div>
            : <h2 className="ds-h2" style={{ margin: 0, marginRight: 'auto' }}>{title}</h2>}
          {toolbar}
          <button type="button" className="ds-btn ds-btn--secondary" onClick={goBack}>{closeLabel}</button>
        </div>
      </div>
      {sub}
      <div className="cfs-body" style={{
        flex: 1, minHeight: 0, overflow: 'auto', overscrollBehavior: 'contain', padding: panel ? undefined : 'var(--space-20)',
        // колонка по центру и с полосой прокрутки стоит там же, где шапка без неё
        ...(column && { scrollbarGutter: 'stable both-edges' }),
      }}>
        {children}
      </div>
    </>
  );

  if (panel) {
    return (
      <div className="cfs-layer" style={{ zIndex: CONCEPT_SHEET_Z }}>
        <div role="presentation" className="cfs-scrim" onClick={goBack} />
        <div role="dialog" aria-modal="true" aria-label={title} className="cfs-panel">{content}</div>
      </div>
    );
  }
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{ position: 'fixed', inset: 0, zIndex: CONCEPT_SHEET_Z, background: 'var(--bg)', display: 'flex', flexDirection: 'column', paddingTop: 'var(--safe-top)' }}
    >
      {content}
    </div>
  );
}
