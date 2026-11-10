import { useCallback, useState } from 'react';
import { ShareIcon } from '../../../../shared/src/share/ShareIcon';
import { ShareCardSheet } from '../../share/ShareCardSheet';
import { drawSchemaCard } from '../../../../shared/src/share/cards/schemaCard';
import { modeShareText } from '../../../../shared/src/share/shareTexts';
import { botShortUrl } from '../../utils/botConfig';

/** «Поделиться» у режима справочника (паритет с мини-аппом): тихая ссылка в раскрытой строке режима
 *  (имя кнопки называет режим) + лист с карточкой. Состояние листа живёт здесь, а не в ModesTab. */
export function ModeShareButton({ group, color, name, feel, desc }: {
  group: string;
  color: string;
  name: string;
  feel: string;
  desc: string;
}) {
  const [open, setOpen] = useState(false);
  const draw = useCallback(
    (canvas: HTMLCanvasElement) =>
      drawSchemaCard(canvas, {
        domain: group,
        domainColor: color,
        name,
        desc,
        belief: `Чувствуется как: ${feel}`,
        footerLabel: 'Режимы',
      }),
    [group, color, name, desc, feel],
  );
  return (
    <>
      <button type="button" className="ds-link ss-share-link" aria-label={`Поделиться режимом «${name}»`} onClick={() => setOpen(true)}>
        <ShareIcon /> Поделиться
      </button>
      {open && (
        <ShareCardSheet
          title="Карточка режима"
          draw={draw}
          shareText={modeShareText(name, botShortUrl)}
          filename="mode.png"
          eventKind="mode"
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
