import type { CSSProperties, ReactNode } from 'react';

interface Props {
  /** Оттенок цветной бумаги плитки (hue для .ct-square, см. webapp/src/lib/tone.ts). */
  hue: number;
  art: ReactNode;
  title: string;
  text: string;
  /** null — данные ещё грузятся: плашка-скелетон вместо выдуманной подписи. */
  meta: string | null;
  onClick: () => void;
}

/** Квадрат цветной бумаги на главной «Сегодня» (референс владельца 2026-11-04):
 *  заголовок, подпись, картинка-аппликация, внизу мета из данных и стрелка.
 *  Не ds-card--nav: там строка «картинка слева — текст — шеврон», здесь колонка. */
export function HomeSquare({ hue, art, title, text, meta, onClick }: Props) {
  return (
    <button type="button" className="ct-tile ct-square" style={{ '--h': hue } as CSSProperties} onClick={onClick}>
      <span className="ct-tile-title">{title}</span>
      <span className="ct-tile-text">{text}</span>
      {art}
      <span className="ct-square-foot">
        {meta === null
          ? <span className="ct-tile-meta ct-tile-meta--skeleton" aria-hidden="true" />
          : <span className="ct-tile-meta">{meta}</span>}
        <span className="ct-arrow" aria-hidden="true">→</span>
      </span>
    </button>
  );
}
