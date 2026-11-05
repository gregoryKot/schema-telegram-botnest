import type { CSSProperties } from 'react';
import { Talk } from './art/PaperArtSigns';

/** Талк сверху по центру: разговор с человеком, которому доверились. */
export function PrivacyArt() {
  return <div className="sk-priv-art"><Talk size="square" /></div>;
}

/** Карточка гарантии — шалфейная бумага без картинки. */
export function PrivacyItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="pp-paper sk-priv-item" style={{ '--h': 135 } as CSSProperties}>
      <div className="sk-priv-item-title">{title}</div>
      <div className="sk-priv-item-text">{text}</div>
    </div>
  );
}
