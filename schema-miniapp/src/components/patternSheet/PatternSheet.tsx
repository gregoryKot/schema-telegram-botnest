// Единый экран паттерна (схема ИЛИ режим) — открывается тапом по строке в
// «Мои схемы»/«Мои режимы» ВМЕСТО прямого опросника (правило онбординга +
// «одна механика — один компонент», см. CLAUDE.md). Состав: карточка-портрет
// (заполнена → ответы, пусто → объяснение и CTA «Заполнить»), записи
// дневника с этим паттерном, ссылка на энциклопедию. В опросник ведёт
// только явная кнопка «Заполнить»/«Дополнить».
import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { BottomSheet } from '../BottomSheet';
import { useTr } from '../../utils/addressForm';
import { SchemaIntroSheet } from '../SchemaIntroSheet';
import { ModeIntroSheet } from '../ModeIntroSheet';
import { SchemaDetailSheet } from '../SchemaDetailSheet';
import { ShareCardSheet } from '../../share/ShareCardSheet';
import { drawNoteCard } from '../../../../shared/src/share/cards/noteCard';
import { buildSchemaIntroExplainer } from '../../../../shared/src/schema/schemaFlowExplainers';
import { buildModeIntroExplainer } from '../../../../shared/src/mode/modeFlowExplainers';
import { botShortUrl } from '../../utils/botConfig';
import { api } from '../../api';
import { patternMeta } from './patternMeta';
import { PatternSheetHeader } from './PatternSheetHeader';
import { PatternCardSection } from './PatternCardSection';
import { PatternEntriesSection } from './PatternEntriesSection';
import type { MyCardsKind, MyCardItem } from '../myCards/useMyCards';
import type { SchemaDiaryEntry, ModeDiaryEntry } from '../../types';

const EMPTY_TEXT: Record<MyCardsKind, string> = {
  schema: 'Записей с этой схемой пока нет.',
  mode: 'Записей с этим режимом пока нет.',
};
const NOUN: Record<MyCardsKind, string> = { schema: 'схемы', mode: 'режима' };
const SHEET_TITLE: Record<MyCardsKind, string> = {
  schema: 'Карточка схемы',
  mode: 'Карточка режима',
};

interface Props {
  kind: MyCardsKind;
  id: string;
  /** Заполненные заметки — общий источник со строкой статуса в списке
   *  (usePatternStatus в родителе), второй запрос не нужен. */
  items: MyCardItem[];
  reload: () => void;
  schemaEntries?: SchemaDiaryEntry[];
  setSchemaEntries?: Dispatch<SetStateAction<SchemaDiaryEntry[]>>;
  modeEntries?: ModeDiaryEntry[];
  setModeEntries?: Dispatch<SetStateAction<ModeDiaryEntry[]>>;
  onClose: () => void;
}

export function PatternSheet({
  kind,
  id,
  items,
  reload,
  schemaEntries = [],
  setSchemaEntries,
  modeEntries = [],
  setModeEntries,
  onClose,
}: Props) {
  const tr = useTr();
  const [subView, setSubView] = useState<'edit' | 'info' | null>(null);
  const [showShare, setShowShare] = useState(false);
  const meta = patternMeta(kind, id);
  if (!meta) return null;
  const item = items.find((i) => i.id === id);

  const entries =
    kind === 'schema'
      ? schemaEntries.filter((e) => e.schemaIds.includes(id))
      : modeEntries.filter((e) => e.modeId === id);

  function onSubClose() {
    setSubView(null);
    reload();
  }

  function deleteEntry(entryId: number) {
    if (kind === 'schema') {
      api.deleteSchemaDiary(entryId).catch(() => {});
      setSchemaEntries?.((prev) => prev.filter((e) => e.id !== entryId));
    } else {
      api.deleteModeDiary(entryId).catch(() => {});
      setModeEntries?.((prev) => prev.filter((e) => e.id !== entryId));
    }
  }

  if (subView === 'edit')
    return kind === 'schema' ? (
      <SchemaIntroSheet schemaId={id} onClose={onSubClose} />
    ) : (
      <ModeIntroSheet modeId={id} onClose={onSubClose} />
    );

  if (subView === 'info')
    return kind === 'schema' ? (
      <SchemaDetailSheet
        schemaId={id}
        onClose={onSubClose}
        onOpenDiary={() => setSubView('edit')}
      />
    ) : (
      <ModeIntroSheet modeId={id} forcePortrait onClose={onSubClose} />
    );

  return (
    <>
      <BottomSheet onClose={onClose}>
        <div style={{ paddingTop: 4 }}>
          <PatternSheetHeader
            color={meta.color}
            name={meta.name}
            subtitle={meta.subtitle}
            onBack={onClose}
          />

          <PatternCardSection
            color={meta.color}
            explainer={
              kind === 'schema'
                ? buildSchemaIntroExplainer(tr)
                : buildModeIntroExplainer(tr)
            }
            fields={item?.cardFields ?? null}
            onEdit={() => setSubView('edit')}
            onShare={() => setShowShare(true)}
          />

          <PatternEntriesSection
            kind={kind}
            color={meta.color}
            entries={entries}
            onDeleteEntry={deleteEntry}
            emptyText={EMPTY_TEXT[kind]}
          />

          <button
            onClick={() => setSubView('info')}
            style={{
              width: '100%',
              marginTop: 18,
              padding: '12px 0',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-sub)',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {kind === 'schema' ? 'О схеме' : 'О режиме'} →
          </button>
        </div>
      </BottomSheet>

      {showShare && item && (
        <ShareCardSheet
          title={SHEET_TITLE[kind]}
          draw={(canvas) =>
            drawNoteCard(canvas, {
              color: meta.color,
              title: meta.name,
              subtitle: meta.subtitle,
              fields: item.cardFields,
            })
          }
          shareText={`Моя карточка ${NOUN[kind]} «${meta.name}».\n\n${botShortUrl}`}
          filename={`${kind}-card.png`}
          eventKind={kind}
          onClose={() => setShowShare(false)}
          zIndex={220}
        />
      )}
    </>
  );
}
