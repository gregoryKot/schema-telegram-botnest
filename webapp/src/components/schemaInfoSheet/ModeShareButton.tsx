import { useCallback, useState } from 'react';
import { SharePillButton } from '../../share/SharePillButton';
import { ShareCardSheet } from '../../share/ShareCardSheet';
import { drawSchemaCard } from '../../../../shared/src/share/cards/schemaCard';
import { modeShareText } from '../../../../shared/src/share/shareTexts';
import { botShortUrl } from '../../utils/botConfig';

/**
 * «Поделиться» у режима во вкладке «Режимы» справочника (паритет с мини-аппом):
 * кнопка-значок + лист с карточкой. Состояние листа живёт здесь, а не в ModesTab.
 */
export function ModeShareButton({
  group,
  color,
  name,
  feel,
  desc,
}: {
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
      <SharePillButton label={`Поделиться режимом «${name}»`} onClick={() => setOpen(true)} />
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
