import type { MutableRefObject, ReactNode } from 'react';
import type { BetweenSessionsItem, TechniqueGuide, TechniqueId } from '../../../../../shared/src/schemaTherapy/guide';
import type { GuideHintView } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide';
import type { GuideNotes } from '../../../../../shared/src/therapy/conceptGraph/guideHistory';
import { GuideSignArt } from '../../art/GuideSigns';
import { TECHNIQUE_SIGN } from '../../art/guideSignsModel';
import { NeedFold } from '../../NeedFold';
import { ConceptFullscreenSheet, type SheetBack } from '../ConceptFullscreenSheet';
import { GuideSection, GuideSources } from './GuideSection';
import { GUIDE_COLUMN, guideTextStyle } from './guideStyles';
import { TechniqueDoneNote } from './TechniqueMarkRow';
import '../../../styles/therapist-guide.css';

/** Раздел под «Подробнее»: подпись и абзац или своё содержимое (копинг схемы). Пустой не рисуется. */
export interface GuideMorePart { title: string; text?: string; children?: ReactNode }

interface PageProps {
  /** Что за лист — подпись в шапке: «Техника», «Режим», «Схема». */
  label: string;
  title: string;
  /** Суть одной-двумя фразами — подпись героя. */
  lede: string;
  art: ReactNode;
  onClose: () => void;
  /** Пункты «Подробнее» из текста раздела (`more`). */
  more?: string[];
  /** Разделы «Подробнее» после пунктов. */
  moreParts?: GuideMorePart[];
  sources: string;
  /** Сюда лист кладёт свой goBack: «журнал →» сначала закрывает листы (useConceptGuide). */
  backRef?: MutableRefObject<SheetBack | null>;
  children: ReactNode;
}

/**
 * Каркас листа подсказок (#995, пилот живого языка 2026-11) — один на листы техники,
 * режима и схемы: в шапке подпись и «Закрыть», герой бумажной аппликации (заголовок
 * Literata, суть, знак справа — docs/design/PAPER_2026-11.md), свои разделы листа,
 * «Подробнее» (закрыто по умолчанию, NeedFold) и мелко «Источники». Шапка и
 * содержимое стоят в одной колонке. Оболочка — ConceptFullscreenSheet
 * (useHistorySheet, «Назад» браузера закрывает лист).
 */
export function GuidePage({ label, title, lede, art, onClose, more = [], moreParts = [], sources, backRef, children }: PageProps) {
  const items = more.filter((m) => m.trim());
  const parts = moreParts.filter((p) => p.children || p.text?.trim());
  return (
    <ConceptFullscreenSheet title={title} label={label} column={GUIDE_COLUMN} closeLabel="Закрыть" onClose={onClose} backRef={backRef}>
      <div className="gd-page" style={{ maxWidth: GUIDE_COLUMN }}>
        <div className="gd-hero">
          <h2 className="pp-hero-title">{title}</h2>
          {art}
          {lede.trim() && <p className="pp-hero-text">{lede}</p>}
        </div>
        {children}
        {(items.length > 0 || parts.length > 0) && (
          <div className="gd-more">
            <NeedFold title="Подробнее">
              {items.length > 0 && <GuidePoints items={items} />}
              {parts.map((p) => <GuideSection key={p.title} title={p.title} text={p.text}>{p.children}</GuideSection>)}
            </NeedFold>
          </div>
        )}
        <GuideSources text={sources} />
      </div>
    </ConceptFullscreenSheet>
  );
}

/** «Как это звучит»: реплики терапевта на цветной бумаге; кавычки ставит лист, в данных их нет. */
export function GuideVoice({ lines = [] }: { lines?: string[] }) {
  const said = lines.filter((l) => l.trim());
  if (said.length === 0) return null;
  return (
    <section aria-label="Как это звучит" className="pp-paper gd-voice">
      <h3 className="ds-label" style={{ margin: 0 }}>Как это звучит</h3>
      {said.map((line, i) => <blockquote key={i} className="gd-voice-line">«{line}»</blockquote>)}
    </section>
  );
}

/** Пункт списка: строка или подпись канала работы над строкой. */
export type GuidePoint = string | { lead: string; text: string };

/** Шаги (`ordered`: крупный номер слева) или главные пункты (кружок-маркер). */
export function GuidePoints({ items, ordered }: { items: GuidePoint[]; ordered?: boolean }) {
  const List = ordered ? 'ol' : 'ul';
  return (
    <List className={ordered ? 'gd-steps' : 'gd-points'}>
      {items.map((item, i) => (
        <li key={i}>
          {typeof item === 'string' ? item : <><span className="gd-lead">{item.lead}</span>{item.text}</>}
        </li>
      ))}
    </List>
  );
}

/** Колбэки листа раздела (режима или схемы). */
export interface GuideSheetActions {
  onOpenTechnique: (id: TechniqueId) => void;
  /** «Дать заданием»; нет — лист без кнопок заданий (справочник без клиента). */
  onAssign?: (item: BetweenSessionsItem) => void;
  onClose: () => void;
  /** История серым: «делали …» у техники, «давали …» у задания; нет — без строк. */
  notes?: GuideNotes;
  /** «журнал →» за «делали …» — журнал техник карточки клиента; нет — без ссылки. */
  onOpenJournal?: () => void;
  /** Сюда лист кладёт свой goBack: «журнал →» сначала закрывает листы (useConceptGuide). */
  backRef?: MutableRefObject<SheetBack | null>;
}

type Props = GuideSheetActions & Omit<PageProps, 'more' | 'sources' | 'onClose'> & {
  voice?: string[];
  view: GuideHintView & { guide: { stuck?: string; sources: string; more?: string[] } };
};

/**
 * Лист раздела справочника (#995) — режима или схемы: каркас GuidePage, «Как это
 * звучит», свои разделы листа, затем общий хвост — «На сессии» (тап по технике →
 * лист техники поверх), «Между сессиями» с «Дать заданием»; «Где застревают» —
 * последним разделом «Подробнее». У техники и задания — история серым (`notes`,
 * guideHistory.ts), за «делали …» — «журнал →» (`onOpenJournal`); `backRef` идёт
 * в каркас (GuidePage). Пустой раздел не рисуется.
 */
export function GuideSheet({ view, voice, moreParts = [], onOpenTechnique, onAssign, onClose, notes, onOpenJournal, children, ...page }: Props) {
  const { guide, techniques } = view;
  return (
    <GuidePage
      {...page} onClose={onClose} sources={guide.sources} more={guide.more}
      moreParts={[...moreParts, { title: 'Где застревают', text: guide.stuck }]}
    >
      <GuideVoice lines={voice} />
      {children}
      <GuideTechniques techniques={techniques} onOpen={onOpenTechnique} notes={notes} onOpenJournal={onOpenJournal} />
      <GuideBetweenSessions items={guide.betweenSessions} onAssign={onAssign} notes={notes} />
    </GuidePage>
  );
}

/** «На сессии»: знак техники, техника — кнопка с описанием, «делали …» и «журнал →». */
function GuideTechniques({ techniques, onOpen, notes, onOpenJournal }: {
  techniques: TechniqueGuide[]; onOpen: (id: TechniqueId) => void; notes?: GuideNotes; onOpenJournal?: () => void;
}) {
  if (techniques.length === 0) return null;
  return (
    <GuideSection title="На сессии">
      <ul className="tcp-guide-list">
        {techniques.map((t) => (
          <li key={t.id} className="gd-tech">
            <span className="pp-row-art"><GuideSignArt sign={TECHNIQUE_SIGN[t.id]} size="row" /></span>
            <div style={{ minWidth: 0 }}>
              <button type="button" className="tcp-guide-link" onClick={() => onOpen(t.id)}>{t.name}</button>
              <div className="ds-sub">{t.summary}</div>
              <TechniqueDoneNote text={notes?.technique(t.id)} onOpenJournal={onOpenJournal} />
            </div>
          </li>
        ))}
      </ul>
    </GuideSection>
  );
}

/** «Между сессиями»: название, серым пояснение или инструкция и «давали …», «Дать заданием». */
function GuideBetweenSessions({ items, onAssign, notes }: {
  items: BetweenSessionsItem[]; onAssign?: (item: BetweenSessionsItem) => void; notes?: GuideNotes;
}) {
  if (items.length === 0) return null;
  return (
    <GuideSection title="Между сессиями">
      <ul className="tcp-guide-list">
        {items.map((item, i) => {
          const sub = item.kind === 'task' ? item.note : item.text;
          return (
            <li key={`${i}:${item.title}`} className="tcp-guide-task">
              <div style={{ minWidth: 0 }}>
                <div style={{ ...guideTextStyle, fontWeight: 600 }}>{item.title}</div>
                {sub && <div className="ds-sub">{sub}</div>}
                <GuideNote text={notes?.task(item)} />
              </div>
              {onAssign && (
                <button
                  type="button" className="ds-btn ds-btn--secondary"
                  aria-label={`Дать заданием: ${item.title}`} onClick={() => onAssign(item)}
                >
                  Дать заданием
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </GuideSection>
  );
}

/** Строка истории: мелко и серым, нечего сказать — ничего. */
function GuideNote({ text }: { text?: string | null }) {
  return text ? <div className="ds-sub">{text}</div> : null;
}
