import type { CSSProperties } from 'react';
import { SceneCabinet } from './art/SceneCabinet';
import { SignArt } from './art/SignArt';
import { BrandMark } from './art/BrandMark';
import type { PrivacySign } from './therapist/cabinetLook';

/** Первый вход в кабинет — сцена кабинета (b29): разговоры с людьми и записи о них. */
export function PrivacyArt() {
  return <div className="sk-priv-art" aria-hidden="true"><SceneCabinet /></div>;
}

/** Плитка гарантии 2×2 (pp-square без нажатия): бумага и знак — PRIVACY_TILE_LOOK. */
export function PrivacyItem({ title, text, hue, sign }: { title: string; text: string; hue: number; sign: PrivacySign }) {
  return (
    <div className="pp-paper sk-priv-item" style={{ '--h': hue } as CSSProperties}>
      <span className="sk-priv-item-sign" aria-hidden="true">
        {sign === 'brand' ? <BrandMark size={28} simple bare /> : <SignArt sign={sign} size="row" />}
      </span>
      <div className="sk-priv-item-title">{title}</div>
      <div className="sk-priv-item-text">{text}</div>
    </div>
  );
}
