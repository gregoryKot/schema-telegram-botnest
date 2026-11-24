import { useContext, useEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { GuideMarkContext } from './GuideSectionMark';
import { readGuideSelection, type GuideSelection } from './guideSelection';

/**
 * «Про клиента» для выделенного в справочнике текста: плавающая кнопка у нижнего края (на телефоне системное
 * меню выделения стоит у самого текста). Тап не отбирает выделение; текст сохранён до открытия листа.
 */
export function GuideSelectionBar({ pageRef }: { pageRef: RefObject<Element | null> }) {
  const ctx = useContext(GuideMarkContext);
  const [picked, setPicked] = useState<GuideSelection | null>(null);
  const active = !!ctx?.onFragment;
  useEffect(() => {
    if (!active) return;
    const read = () => setPicked(readGuideSelection(window.getSelection(), pageRef.current));
    document.addEventListener('selectionchange', read);
    return () => document.removeEventListener('selectionchange', read);
  }, [active, pageRef]);
  if (!ctx?.onFragment || !picked) return null;
  const { onFragment } = ctx;
  const keep = (e: { preventDefault: () => void }) => e.preventDefault();
  return createPortal(
    <div className="gd-sel-bar" role="toolbar" aria-label="Выделенный текст">
      <button
        type="button" className="gd-sel-btn" onMouseDown={keep} onPointerDown={keep}
        onClick={() => { onFragment(picked); window.getSelection()?.removeAllRanges(); setPicked(null); }}
      >
        Про клиента
      </button>
    </div>,
    document.body,
  );
}
