import { Fragment, useEffect, useRef, useState } from 'react';
import { foldFirstSentence, splitCites } from './guideTextModel';

/** Текст листа: метки книг «[Кембридж, гл. 8]» — тихим span; пробел перед меткой снаружи span, слово не тянется за ней. */
export function Cited({ text }: { text: string }) {
  return <>{splitCites(text).map((p, i) => (p.cite ? <Fragment key={i}>{' '}<span className="gd-cite">{p.text.trim()}</span></Fragment> : p.text))}</>;
}

/** Длинный пункт — первая фраза и «ещё»; короткий — целиком. Остаток в DOM под hidden="until-found": Ctrl+F его находит. */
export function FoldText({ text }: { text: string }) {
  const fold = foldFirstSentence(text);
  const [open, setOpen] = useState(false);
  const restRef = useRef<HTMLSpanElement>(null);
  // hidden="until-found" ставится руками: типы React знают у hidden только boolean.
  useEffect(() => {
    const el = restRef.current;
    if (!el) return;
    if (open) el.removeAttribute('hidden');
    else el.setAttribute('hidden', 'until-found');
    const onMatch = () => setOpen(true);
    el.addEventListener('beforematch', onMatch);
    return () => el.removeEventListener('beforematch', onMatch);
  }, [open, text]);
  if (!fold) return <Cited text={text} />;
  return (
    <>
      <Cited text={fold.head} />{' '}
      <span ref={restRef}><Cited text={fold.rest} />{' '}</span>
      <button type="button" className="ds-link gd-fold" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        {open ? 'свернуть' : 'ещё'}
      </button>
    </>
  );
}
