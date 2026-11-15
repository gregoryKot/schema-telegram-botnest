// Плитка быстрой практики на бумаге своей сущности — одна на квадраты «Здесь и сейчас» (QuickSquares, счётчик из
// данных) и «Что поможет» экрана паттерна (PatternHelpSection, plain — без счётчика); вид формы держит CSS экрана.
import type { CSSProperties } from 'react';
import type { Look } from '../../../../shared/src/theme/entityLook';
import { glue } from '../../../../shared/src/utils/typo';
import { SignArt } from '../art/SignArt';
import { SignHero } from '../paper/SignHero';

const FORM = {
  square: { tile: 'pp-paper pp-square cp-sq', title: 'pp-title', text: 'pp-text', sign: 'cp-sq-art' }, // client-practice.css
  plain: { tile: 'pp-paper ps-practice', title: 'ps-practice-title', text: 'ps-practice-sub', sign: 'ps-practice-sign' }, // pattern-sheet.css
} as const;

interface Base { look: Look; title: string; text: string; onClick: () => void }
/** meta — подпись счётчика (practiceCountLabel считает вызывающий: иначе общий чанк экранов тянет чанк листа практики);
 *  undefined — ещё грузится (плашка-скелетон), null — не пришло (без меты, без выдуманного нуля). */
type Props = Base & ({ plain?: false; meta: string | null | undefined } | { plain: true; meta?: never });

export function QuickTile({ look, title, text, onClick, plain, meta }: Props) {
  const f = plain ? FORM.plain : FORM.square;
  return (
    <button type="button" className={f.tile} style={{ '--h': look.hue } as CSSProperties} onClick={onClick}>
      <span className={f.title}>{glue(title)}</span>
      <span className={f.text}>{glue(text)}</span>
      <span className={f.sign} aria-hidden="true">{plain ? <SignArt sign={look.sign} size="square" /> : <SignHero sign={look.sign} />}</span>
      {!plain && (
        <span className="pp-square-foot">
          {meta === undefined ? <span className="pp-meta pp-meta--skeleton" aria-hidden="true" /> : <span className="pp-meta">{meta && glue(meta)}</span>}
          <span className="pp-arrow" aria-hidden="true">→</span>
        </span>
      )}
    </button>
  );
}
