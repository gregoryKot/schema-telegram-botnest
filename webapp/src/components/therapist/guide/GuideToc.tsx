import { useEffect, useRef, useState } from 'react';
import { tocLabel } from './guideTextModel';

interface Entry { label: string; el: HTMLElement }

/** Разделы листа верхнего уровня (`section[aria-label]` прямо в .gd-page) — по порядку на листе. */
function readEntries(page: HTMLElement): Entry[] {
  return [...page.querySelectorAll<HTMLElement>(':scope > section[aria-label]')]
    .map((el) => ({ label: tocLabel(el.getAttribute('aria-label') ?? ''), el }))
    .filter((e) => e.label);
}

/**
 * Полоса-оглавление под героем листа: чипы-якоря к разделам, прилипает при прокрутке. Список читает из
 * разметки листа — разделы рисует GuideSection, адреса и «Про клиента» не меняются. Меньше трёх разделов — полосы нет.
 */
export function GuideToc() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const probe = useRef<HTMLElement>(null);
  useEffect(() => {
    const page = probe.current?.parentElement;
    if (!page) return;
    const update = () => setEntries(readEntries(page));
    update();
    const obs = new MutationObserver(update);
    obs.observe(page, { childList: true });
    return () => obs.disconnect();
  }, []);
  // Пустой span — якорь к листу (.gd-page — его родитель), пока чипов нет.
  if (entries.length < 3) return <span ref={probe} hidden />;
  return (
    <nav ref={probe} className="gd-toc" aria-label="Разделы листа">
      {entries.map((e) => (
        <button key={e.label} type="button" className="ds-chip ds-chip--toggle gd-toc-chip" onClick={() => e.el.scrollIntoView?.({ behavior: 'smooth', block: 'start' })}>
          {e.label}
        </button>
      ))}
    </nav>
  );
}
