import { useState } from 'react';
import { ShareCardSheet } from '../../share/ShareCardSheet';
import {
  modeEntryShareProps,
  type ModeEntryMode,
} from '../../../../shared/src/share/cards/modeEntryCard';
import { botShortUrl } from '../../utils/botConfig';

/**
 * Сохранить/поделиться записью режима карточкой — «голос Здорового Взрослого».
 * Только когда клиент написал ответ ЗВ. Тап явный (stopPropagation — не
 * сворачивает запись), с превью. Общий конфиг — modeEntryShareProps (shared).
 */
export function ModeEntryShare({
  mode,
  healthyResponse,
  color = 'var(--c-slate)',
}: {
  mode?: ModeEntryMode;
  healthyResponse?: string | null;
  color?: string;
}) {
  const [showShare, setShowShare] = useState(false);
  if (!mode || !healthyResponse) return null;

  return (
    <>
      <div style={{ marginTop: 4 }}>
        <div
          style={{
            fontSize: 11.5,
            color: 'var(--text-faint)',
            lineHeight: 1.5,
            marginBottom: 8,
          }}
        >
          Можно сохранить карточку и перечитывать, когда снова накроет.
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowShare(true);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: color + '18',
            border: 'none',
            borderRadius: 8,
            padding: '6px 12px',
            color,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Сохранить карточку
        </button>
      </div>
      {showShare && (
        <ShareCardSheet
          {...modeEntryShareProps(mode, healthyResponse, botShortUrl)}
          onClose={() => setShowShare(false)}
        />
      )}
    </>
  );
}
