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

/** Длинный пункт — первая фраза и «ещё»; короткий — целиком. Остаток в DOM под hidden="until-found": Ctrl+F его находит. */
export function FoldText({ text: raw }: { text: string }) {
  const { text, cites } = liftCites(raw);
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
  if (!fold) return <>{text}<CiteTail cites={cites} /></>;
  return (
    <>
      {fold.head}{' '}
      <span ref={restRef}>{fold.rest}<CiteTail cites={cites} />{' '}</span>
      <button type="button" className="ds-link gd-fold" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        {open ? 'свернуть' : 'ещё'}
      </button>
    </>
  );
}
