import { Fragment, useEffect, useRef, useState } from 'react';
import { foldFirstSentence, splitCites } from './guideTextModel';

/** Текст листа: метки книг «[Кембридж, гл. 8]» — тихим span; пробел перед меткой снаружи span, слово не тянется за ней. */
export function Cited({ text }: { text: string }) {
  return <>{splitCites(text).map((p, i) => (p.cite ? <Fragment key={i}>{' '}<span className="gd-cite">{p.text.trim()}</span></Fragment> : p.text))}</>;
}

/** Длинный пункт — первая фраза и «ещё», короткий — целиком; всё в одном span, иначе в шаге-grid куски разъезжаются по ячейкам. */
export function FoldText({ text }: { text: string }) {
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
  if (!fold) return <span className="gd-fold-text"><Cited text={text} /></span>;
  return (
    <span className="gd-fold-text">
      <Cited text={fold.head} />{' '}
      <span ref={restRef} className="gd-fold-rest" hidden={!open}><Cited text={fold.rest} />{' '}</span>
      <button type="button" className="ds-link gd-fold" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        {open ? 'свернуть' : 'ещё'}
      </button>
    </span>
  );
}
