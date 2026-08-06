// Секция «Мои карточки» внизу вкладок «Схемы»/«Режимы» (раздел «Паттерны»).
// Закрывает обещание из SchemaIntroSheet/ModeIntroSheet.savedHint («карточка
// в разделе «Паттерны», можно открыть и дополнить») — до этого списка не
// было вообще. Тап — открыть/отредактировать существующим шитом (upsert),
// новый эндпоинт не нужен. Поделиться — существующий ShareCardSheet +
// drawNoteCard (shared/src/share/cards/noteCard.ts).
import { useState } from 'react';
import { SectionLabel } from '../SectionLabel';
import { SkeletonList } from '../Skeleton';
import { MyCardsList, MyCardItem } from './MyCardsList';
import { useMyCards, MyCardsKind } from './useMyCards';
import { SchemaIntroSheet } from '../SchemaIntroSheet';
import { ModeIntroSheet } from '../ModeIntroSheet';
import { ShareCardSheet } from '../../share/ShareCardSheet';
import { drawNoteCard } from '../../../../shared/src/share/cards/noteCard';
import { botShortUrl } from '../../utils/botConfig';

const SHEET_TITLE: Record<MyCardsKind, string> = {
  schema: 'Карточка схемы',
  mode: 'Карточка режима',
};

function shareText(item: MyCardItem, kind: MyCardsKind): string {
  const noun = kind === 'schema' ? 'схемы' : 'режима';
  return `Моя карточка ${noun} «${item.name}».\n\n${botShortUrl}`;
}

export function MyCardsSection({ kind }: { kind: MyCardsKind }) {
  const { loading, items, reload } = useMyCards(kind);
  const [openId, setOpenId] = useState<string | null>(null);
  const [shareItem, setShareItem] = useState<MyCardItem | null>(null);

  // Пусто = пусто: ни секции, ни выдуманных примеров, пока нечего показать.
  if (!loading && items.length === 0) return null;

  return (
    <div>
      <SectionLabel>Мои карточки</SectionLabel>
      {loading ? (
        <SkeletonList rows={2} h={64} />
      ) : (
        <MyCardsList items={items} onOpen={setOpenId} onShare={setShareItem} />
      )}

      {openId &&
        (kind === 'schema' ? (
          <SchemaIntroSheet
            schemaId={openId}
            onClose={() => {
              setOpenId(null);
              reload();
            }}
          />
        ) : (
          <ModeIntroSheet
            modeId={openId}
            onClose={() => {
              setOpenId(null);
              reload();
            }}
          />
        ))}

      {shareItem && (
        <ShareCardSheet
          title={SHEET_TITLE[kind]}
          draw={(canvas) =>
            drawNoteCard(canvas, {
              color: shareItem.color,
              title: shareItem.name,
              subtitle: shareItem.subtitle,
              fields: shareItem.cardFields,
            })
          }
          shareText={shareText(shareItem, kind)}
          filename={`${kind}-card.png`}
          eventKind={kind}
          onClose={() => setShareItem(null)}
        />
      )}
    </div>
  );
}
