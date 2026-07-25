import { useState } from 'react';
import { SharePill } from '../../share/SharePill';
import { ShareCardSheet } from '../../share/ShareCardSheet';
import {
  modeEntryShareProps,
  type ModeEntryMode,
} from '../../../../shared/src/share/cards/modeEntryCard';
import { botShortUrl } from '../../utils/botConfig';

/**
 * Сохранить/поделиться записью режима карточкой — «голос Здорового Взрослого».
 * Только когда клиент написал ответ ЗВ (иначе делиться нечем). Тап явный, с
 * превью. Общий конфиг карточки — modeEntryShareProps (shared).
 */
export function ModeEntryShare({
  mode,
  healthyResponse,
}: {
  mode?: ModeEntryMode;
  healthyResponse?: string | null;
}) {
  const [showShare, setShowShare] = useState(false);
  if (!mode || !healthyResponse) return null;

  return (
    <>
      <div
        style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}
      >
        <SharePill compact onClick={() => setShowShare(true)} />
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-faint)',
          marginTop: 6,
          lineHeight: 1.5,
        }}
      >
        Можно сохранить карточку и перечитывать, когда снова накроет.
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
