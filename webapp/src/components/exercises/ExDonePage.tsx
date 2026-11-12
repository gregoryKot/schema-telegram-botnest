// Итог упражнения — одна рамка на всю группу (ревью g6, правило №3): карточки схемы и режима, проверка
// убеждения, письмо, безопасное место, «Критик или забота?». Экран ex2-screen с баром упражнения, слева —
// лист «готово» (DoneSheet и то, что под ним), справа на ≥1024 — необязательная колонка `side`: написанное
// (диалог голосов, ответы) и «прошлые» строками. Без `side` — один лист по центру; на телефоне `side` идёт
// под листом. Строка «прошлого» — одна разметка (ExPastRow): знак сущности, дата, цитата Literata.
// Стили — styles/ex-done.css. До сведения b17 рисовала итог в рамке дневника (sd-done-page), b18 — своей
// сеткой, а списков прошлых было три (ex2-past, ex2-belief-past, PhraseHistoryRows).
import type { ReactNode } from 'react';
import { ExBar } from './ExBar';
import { useExBackLabel } from './exBackLabel';
import { SignArt } from '../art/SignArt';
import { pressable } from '../../utils/a11y';
import type { SignKey } from '../../../../shared/src/theme/entityLook';

export function ExDonePage({ onBack, children, side, sideLabel }: {
  onBack: () => void;
  children: ReactNode;
  /** Колонка справа на ≥1024; пусто (null/false) — колонки нет, лист по центру. */
  side?: ReactNode;
  sideLabel?: string;
}) {
  const backLabel = useExBackLabel();
  return (
    <div className="ex2-screen">
      <ExBar onBack={onBack} label={backLabel} sticky />
      <div className={side ? 'ex2-done-page ex2-done-page--side' : 'ex2-done-page'}>
        <div className="ex2-done-main">{children}</div>
        {side && <section className="ex2-done-side" aria-label={sideLabel}>{side}</section>}
      </div>
    </div>
  );
}

/** «Прошлые письма / проверки / разборы · N» — подпись и строки. */
export function ExPastList({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="ex2-past-list">
      <div className="ds-label">{label}</div>
      {children}
    </div>
  );
}

/** Строка прошлого: знак сущности, дата, цитата Literata (две строки); `children` — строка ниже
 *  (у разбора — «→ стало»). С `onOpen` — вся строка нажимается. */
export function ExPastRow({ sign, date, quote, onOpen, openLabel, children }: {
  sign: SignKey;
  date: string;
  quote: string;
  onOpen?: () => void;
  openLabel?: string;
  children?: ReactNode;
}) {
  const press = onOpen ? { ...pressable(onOpen), 'aria-label': openLabel } : {};
  return (
    <div className="ex2-past" {...press}>
      <SignArt sign={sign} size="row" />
      <div className="ex2-past-body">
        <span className="ex2-past-date">{date}</span>
        <span className="ex2-past-snip">«{quote}»</span>
        {children}
      </div>
    </div>
  );
}
