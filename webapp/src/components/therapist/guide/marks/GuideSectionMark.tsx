import { createContext, useContext, type MouseEvent, type ReactNode } from 'react';
import type { GuideMark } from '../../../../../../shared/src/therapy/guideMarks/guideMarksApi';
import { isMarkableAddress } from './guideMarkModel';

/** Отметки на листах справочника (useGuideMarking): без провайдера разделы — просто текст. */
export interface GuideMarkCtx {
  /** Подсвеченный тапом раздел. */
  selected: string | null;
  select: (address: string | null) => void;
  /** Справочник из карточки клиента: его имя и отметки. В общем справочнике имён нет. */
  client?: { name: string; marked: ReadonlyMap<string, GuideMark> };
  /** «Про клиента» или правка заметки — лист отметки. */
  onMark: (address: string) => void;
  onUnmark: (mark: GuideMark) => void;
}

export const GuideMarkContext = createContext<GuideMarkCtx | null>(null);

// Тап по ссылке или кнопке внутри раздела — их действие, а не подсветка раздела.
const OWN_CONTROLS = 'button, a, input, textarea, label, summary';

export interface SectionMark {
  className: string;
  onTap: (e: MouseEvent) => void;
  /** Подпись раздела кнопкой: путь подсветки с клавиатуры. */
  title: (text: string) => ReactNode;
  controls: ReactNode;
}

/**
 * Жест «тап по разделу → Про клиента» (#1484) — один на все разделы листов: подсветка, кнопка,
 * у отмеченного клиенту раздела — его имя, «Заметка» и «Снять отметку». null — раздел не отмечается.
 */
export function useSectionMark(address: string | undefined): SectionMark | null {
  const ctx = useContext(GuideMarkContext);
  if (!ctx || !isMarkableAddress(address)) return null;
  const picked = ctx.selected === address;
  const mark = ctx.client?.marked.get(address);
  const toggle = () => ctx.select(picked ? null : address);
  return {
    className: `${picked ? ' gd-picked' : ''}${mark ? ' gd-marked' : ''}`,
    onTap: (e) => {
      if (e.target instanceof Element && e.target.closest(OWN_CONTROLS)) return;
      toggle();
    },
    title: (text) => (
      <button type="button" className="gd-mark-title" aria-pressed={picked} onClick={toggle}>{text}</button>
    ),
    controls: (picked || mark) && (
      <div className="gd-mark-row">
        {mark && ctx.client && <span className="gd-mark-who">Отмечено: {ctx.client.name}</span>}
        {mark?.note && <span className="ds-sub">{mark.note}</span>}
        {picked && (
          <span className="gd-acts">
            <button type="button" className="ds-btn ds-btn--secondary" onClick={() => ctx.onMark(address)}>
              {mark ? 'Заметка' : 'Про клиента'}
            </button>
            {mark && (
              <button type="button" className="ds-btn ds-btn--secondary" onClick={() => ctx.onUnmark(mark)}>Снять отметку</button>
            )}
          </span>
        )}
      </div>
    ),
  };
}
