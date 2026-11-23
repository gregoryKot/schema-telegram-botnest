import { useEffect, useRef, useState } from 'react';
import { foldFirstSentence, liftCites } from './guideTextModel';

/** Метки книг тихой строкой в конце абзаца: фраза читается без скобок, книги — на вкладке «Теория». */
export function CiteTail({ cites }: { cites: string[] }) {
  return cites.length ? <>{' '}<span className="gd-cite">{cites.join(' · ')}</span></> : null;
}

/** Текст листа: метки книг «[Кембридж, гл. 8]» уходят из фразы в конец абзаца. */
export function Cited({ text }: { text: string }) {
  const lifted = liftCites(text);
  return <>{lifted.text}<CiteTail cites={lifted.cites} /></>;
}

/** Длинный пункт — первая фраза и «ещё», короткий — целиком; всё в одном span, иначе в шаге-grid куски разъезжаются по ячейкам. */
export function FoldText({ text: raw }: { text: string }) {
  const { text, cites } = liftCites(raw);
  const fold = foldFirstSentence(text);
  const [open, setOpen] = useState(false);
  const restRef = useRef<HTMLSpanElement>(null);
  // Остаток — hidden="until-found" (Ctrl+F находит), где браузер знает beforematch; иначе булев hidden от React.
  useEffect(() => {
    const el = restRef.current;
    if (!el || !('onbeforematch' in el)) return;
    if (!open) el.setAttribute('hidden', 'until-found');
    const onMatch = () => setOpen(true);
    el.addEventListener('beforematch', onMatch);
    return () => el.removeEventListener('beforematch', onMatch);
  }, [open, text]);
  if (!fold) return <span className="gd-fold-text">{text}<CiteTail cites={cites} /></span>;
  return (
    <span className="gd-fold-text">
      {fold.head}{' '}
      <span ref={restRef} className="gd-fold-rest" hidden={!open}>{fold.rest}<CiteTail cites={cites} />{' '}</span>
      <button type="button" className="ds-link gd-fold" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        {open ? 'свернуть' : 'ещё'}
      </button>
    </span>
  );
}
