// Единый экран паттерна на сайте (схема ИЛИ режим) — открывается тапом по
// «Моим схемам»/«Моим режимам» вместо прямого упражнения или справки. Состав:
// герой — лист бумаги домена/группы со знаком паттерна и ссылкой «О схеме/режиме»
// (на ≥1024 — разворот: герой слева, содержимое справа), карточка (заполнена →
// ответы, пусто → объяснение и «Заполнить», сбой загрузки → строка с «Повторить»,
// без «Заполнить»: новое не ляжет поверх сохранённого), «Что поможет», записи
// дневника с этим паттерном. В упражнение ведёт только явная кнопка; после него
// карточки перечитываются (сохранил → нашёл). Под-листы (опросник, «О схеме»,
// «О режиме») — сиблинги экрана позже в DOM, без своей обёртки: обёртка .u-sheet
// (z-index 80) прятала опросник z 200 ПОД экраном паттерна (рецепт стенда
// *-from-pattern-bug, b15).
import { useState, lazy, Suspense, type CSSProperties } from 'react';
import '../../styles/pattern-sheet.css';
import { SsSheet, SsHead } from '../schemaSheets/SsSheet';
import { SchemaDetailSheet } from '../SchemaDetailSheet';
import { ShareCardSheet } from '../../share/ShareCardSheet';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useTr } from '../../utils/addressForm';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
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
import { patternLook } from './patternHue';
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
  /** Заметки не загрузились: «Повторить» вместо «Заполнить» (сбой ≠ пусто). */
  failed?: boolean;
  reload: () => void;
  /** Дневники схем и режимов (общий источник со статусом строки). */
  entries: PatternEntries;
  onClose: () => void;
}

type Sub = 'edit' | 'about' | null;

export function PatternSheet({
  kind, id, items, loading, failed, reload, entries: diary, onClose,
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
  const look = patternLook(kind, id) ?? ENTITY_LOOK[kind === 'schema' ? 'schemas' : 'modes'];
  const about = (
    <button type="button" className="ds-link ps-about" onClick={() => setSub('about')}>
      {kind === 'schema' ? 'О схеме' : 'О режиме'} →
    </button>
  );

  return (
    <>
      <SsSheet onBack={goBack} spread hero={<SsHead look={look} eyebrow={meta.subtitle} title={meta.name} meta={about} />}>
        <div className="ps-body" style={{ '--h': look.hue } as CSSProperties}>
        <PatternCardSection
          explainer={kind === 'schema' ? buildSchemaIntroExplainer(tr) : buildModeIntroExplainer(tr)}
          fields={item?.cardFields ?? null}
          loading={loading}
          failed={failed}
          sign={look.sign}
          onRetry={reload}
          onEdit={() => setSub('edit')}
          onShare={() => setShowShare(true)}
        />
        <PatternHelpSection kind={kind} id={id} />
        <PatternEntriesSection kind={kind} entries={entries} onDeleteEntry={deleteEntry} emptyText={PATTERN_EMPTY_ENTRIES[kind]} />
        </div>
      </SsSheet>

      {sub === 'edit' && (
        <Suspense fallback={null}>
          {kind === 'schema'
            ? <SchemaEx initialSchemaId={id} initialData={item?.values} onBack={closeSub} onComplete={reload} />
            : <ModeEx initialModeId={id} initialData={item?.values} onBack={closeSub} onComplete={reload} />}
        </Suspense>
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
