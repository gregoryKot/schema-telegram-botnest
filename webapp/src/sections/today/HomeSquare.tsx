import type { CSSProperties, ReactNode } from 'react';

interface Props {
  /** Оттенок цветной бумаги плитки (hue для .pp-paper, styles/paper.css). */
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
    <button type="button" className="ct-tile pp-paper pp-square" style={{ '--h': hue } as CSSProperties} onClick={onClick}>
      <span className="pp-title">{title}</span>
      <span className="pp-text">{text}</span>
      {art}
      <span className="pp-square-foot">
        {meta === null
          ? <span className="pp-meta pp-meta--skeleton" aria-hidden="true" />
          : <span className="pp-meta">{meta}</span>}
        <span className="pp-arrow" aria-hidden="true">→</span>
      </span>
    </button>
  );
}
