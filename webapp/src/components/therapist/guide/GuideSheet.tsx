import type { CSSProperties, MutableRefObject, ReactNode } from 'react';
import type { BetweenSessionsItem, TechniqueGuide, TechniqueId } from '../../../../../shared/src/schemaTherapy/guide';
import type { GuideHintView } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide';
import type { GuideNotes } from '../../../../../shared/src/therapy/conceptGraph/guideHistory';
import type { SheetLook } from '../../../../../shared/src/theme/entityLook';
import { SignArt } from '../../art/SignArt';
import { TECHNIQUE_SIGN } from '../../art/guideSignsModel';
import { SignHero } from '../../paper/SignHero';
import { NeedFold } from '../../NeedFold';
import { ConceptFullscreenSheet, type SheetBack } from '../ConceptFullscreenSheet';
import { GuideSection, GuideSources } from './GuideSection';
import { GuidePoints, GuideVoice } from './GuidePoints';
import { TechniqueDoneNote } from './TechniqueMarkRow';
import '../../../styles/therapist-guide.css';

/** Ширина колонки листа подсказок на планшете (на телефоне лист уже, на компьютере — панель справа): строка ~70 знаков,
 *  а не во всю ширину окна. То же число — max-width у .gd-page (therapist-guide.css). */
const GUIDE_COLUMN = 680;

/** Раздел под «Подробнее»: подпись и абзац или своё содержимое (копинг схемы). Пустой не рисуется. */
export interface GuideMorePart { title: string; text?: string; children?: ReactNode }

interface PageProps {
  /** Что за лист — подпись в шапке: «Техника», «Режим», «Схема». */
  label: string;
  title: string;
  /** Суть одной-двумя фразами — подпись героя. */
  lede: string;
  /** Вид листа (guideLook.ts): бумага группы, домена или раздела — квадратик под знаком героя и лист «Как это звучит»;
   *  без знака герой стоит без картинки, без вида (неизвестная схема) — бумага реплики по умолчанию. */
  look?: SheetLook | null;
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
 * режима, схемы и «Для терапевта»: в шапке подпись и «Закрыть», герой бумажной аппликации
 * (заголовок Literata, суть, справа знак с тенью-вырезкой на квадратике бумаги группы или домена — SignHero), свои разделы листа,
 * «Подробнее» (закрыто по умолчанию, NeedFold) и мелко «Источники». Шапка и
 * содержимое стоят в одной колонке. Оболочка — ConceptFullscreenSheet `panel`
 * (useHistorySheet, «Назад» браузера закрывает лист): на компьютере — панель справа над
 * затемнённым «Справочником» или схемой случая, на телефоне — весь экран.
 */
export function GuidePage({ label, title, lede, look, onClose, more = [], moreParts = [], sources, backRef, children }: PageProps) {
  const items = more.filter((m) => m.trim());
  const parts = moreParts.filter((p) => p.children || p.text?.trim());
  return (
    <ConceptFullscreenSheet title={title} label={label} column={GUIDE_COLUMN} closeLabel="Закрыть" onClose={onClose} backRef={backRef} panel>
      <div className="gd-page" style={look ? { '--h': look.hue } as CSSProperties : undefined}>
        <div className="gd-hero">
          <h2 className="pp-hero-title">{title}</h2>
          {look?.sign && <span className="pp-paper gd-hero-art"><SignHero sign={look.sign} /></span>}
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
            <span className="pp-row-art"><SignArt sign={TECHNIQUE_SIGN[t.id]} size="row" /></span>
            <div className="gd-min">
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
              <div className="gd-min">
                <div className="gd-text gd-text--strong">{item.title}</div>
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
