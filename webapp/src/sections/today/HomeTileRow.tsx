import type { ReactNode } from 'react';

interface Props {
  art: ReactNode;
  title: string;
  text: string;
  /** null — данные ещё грузятся: плашка-скелетон вместо выдуманной подписи. */
  meta: string | null;
  onClick: () => void;
}

/** Тихая строка главной «Сегодня»: примитив ds-card--nav (карточка-кнопка), картинка слева,
 *  заголовок, подпись из данных, шеврон. */
export function HomeTileRow({ art, title, text, meta, onClick }: Props) {
  return (
    <button type="button" className="ds-card ds-card--nav ds-card--hover ct-tile ct-tile--row" onClick={onClick}>
      {art}
      <span className="ct-tile-body">
        <span className="ct-tile-title">{title}</span>
        <span className="ct-tile-text">{text}</span>
        {meta === null
          ? <span className="ct-tile-meta ct-tile-meta--skeleton" aria-hidden="true" />
          : <span className="ct-tile-meta">{meta}</span>}
      </span>
      <span className="ds-chev" aria-hidden="true">›</span>
    </button>
  );
}
