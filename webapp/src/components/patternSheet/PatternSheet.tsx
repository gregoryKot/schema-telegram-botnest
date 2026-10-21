// Единый экран паттерна на сайте (схема ИЛИ режим) — открывается тапом по
// «Моим схемам»/«Моим режимам» вместо прямого упражнения или справки. Состав
// как в мини-аппе (schema-miniapp/.../patternSheet/PatternSheet.tsx): карточка
// (заполнена → ответы, пусто → объяснение и «Заполнить»), «Что поможет»,
// записи дневника с этим паттерном, ссылка на справку. В упражнение ведёт
// только явная кнопка; после него карточки перечитываются (сохранил → нашёл).
import { useState, lazy, Suspense } from 'react';
import '../../styles/pattern-sheet.css';
import { SsSheet } from '../schemaSheets/SsSheet';
import { SchemaDetailSheet } from '../SchemaDetailSheet';
import { ShareCardSheet } from '../../share/ShareCardSheet';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useTr } from '../../utils/addressForm';
import { hueStyle } from '../../lib/tone';
import { api } from '../../api';
import { botShortUrl } from '../../utils/botConfig';
import { patternMeta } from '../../../../shared/src/pattern/patternMeta';
import { usePatternEntryDelete } from '../../../../shared/src/pattern/usePatternEntryDelete';
import {
  PATTERN_EMPTY_ENTRIES,
  PATTERN_SHARE_TITLE,
  patternShareText,
} from '../../../../shared/src/pattern/patternShare';
import { drawNoteCard } from '../../../../shared/src/share/cards/noteCard';
import { buildSchemaIntroExplainer } from '../../../../shared/src/schema/schemaFlowExplainers';
import { buildModeIntroExplainer } from '../../../../shared/src/mode/modeFlowExplainers';
import type { MyCardsKind, MyCardItem } from '../../../../shared/src/pattern/useMyCards';
import type { PatternEntries } from '../../sections/schemas/usePatternEntries';
import { patternHue } from './patternHue';
import { PatternCardSection } from './PatternCardSection';
import { PatternHelpSection } from './PatternHelpSection';
import { PatternEntriesSection } from './PatternEntriesSection';
import { ModeAboutSheet } from './ModeAboutSheet';

const SchemaEx = lazy(() => import('../exercises/FlashcardEx').then((m) => ({ default: m.SchemaEx })));
const ModeEx = lazy(() => import('../exercises/FlashcardEx').then((m) => ({ default: m.ModeEx })));

interface Props {
  kind: MyCardsKind;
  id: string;
  /** Заполненные заметки — общий источник со статусом строки в списке. */
  items: MyCardItem[];
  /** Заметки ещё грузятся (силуэт вместо ложного «карточка пуста»). */
  loading?: boolean;
  reload: () => void;
  /** Дневники схем и режимов (общий источник со статусом строки). */
  entries: PatternEntries;
  onClose: () => void;
}

type Sub = 'edit' | 'about' | null;

export function PatternSheet({
  kind, id, items, loading, reload, entries: diary, onClose,
}: Props) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const [sub, setSub] = useState<Sub>(null);
  const [showShare, setShowShare] = useState(false);
  const deleteEntry = usePatternEntryDelete({ api, kind, ...diary });
  const meta = patternMeta(kind, id);
  if (!meta) return null;
  const item = items.find((i) => i.id === id);
  const entries = kind === 'schema' ? diary.schemaEntries.filter((e) => e.schemaIds.includes(id)) : diary.modeEntries.filter((e) => e.modeId === id);

  const closeSub = () => { setSub(null); reload(); };
  const hue = hueStyle(patternHue(kind, id));

  return (
    <>
      <SsSheet onBack={goBack} zIndex={205}>
        <div className="ss-head" style={hue}>
          {meta.subtitle && <span className="ds-chip tone-tint ps-tag">{meta.subtitle}</span>}
          <h1 className="ss-title">{meta.name}</h1>
        </div>

        <PatternCardSection
          explainer={kind === 'schema' ? buildSchemaIntroExplainer(tr) : buildModeIntroExplainer(tr)}
          fields={item?.cardFields ?? null}
          loading={loading}
          onEdit={() => setSub('edit')}
          onShare={() => setShowShare(true)}
        />
        <PatternHelpSection kind={kind} id={id} />
        <PatternEntriesSection kind={kind} entries={entries} onDeleteEntry={deleteEntry} emptyText={PATTERN_EMPTY_ENTRIES[kind]} />

        <button className="ds-link ps-about" onClick={() => setSub('about')}>
          {kind === 'schema' ? 'О схеме' : 'О режиме'} →
        </button>
      </SsSheet>

      {sub === 'edit' && (
        <div className="u-sheet">
          <Suspense fallback={null}>
            {kind === 'schema'
              ? <SchemaEx initialSchemaId={id} initialData={item?.values} onBack={closeSub} onComplete={reload} />
              : <ModeEx initialModeId={id} initialData={item?.values} onBack={closeSub} onComplete={reload} />}
          </Suspense>
        </div>
      )}
      {sub === 'about' && (kind === 'schema'
        ? <SchemaDetailSheet schemaId={id} onClose={() => setSub(null)} />
        : <ModeAboutSheet modeId={id} onClose={() => setSub(null)} onFill={() => setSub('edit')} />)}
      {showShare && item && (
        <ShareCardSheet
          title={PATTERN_SHARE_TITLE[kind]}
          draw={(canvas) => drawNoteCard(canvas, { color: meta.color, title: meta.name, subtitle: meta.subtitle, fields: item.cardFields })}
          shareText={patternShareText(kind, meta.name, botShortUrl)}
          filename={`${kind}-card.png`}
          eventKind={kind}
          onClose={() => setShowShare(false)}
          zIndex={320}
        />
      )}
    </>
  );
}
