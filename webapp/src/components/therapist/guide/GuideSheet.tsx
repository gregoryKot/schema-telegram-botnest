import type { CSSProperties, MutableRefObject, ReactNode } from 'react';
import type { BetweenSessionsItem, TechniqueId } from '../../../../../shared/src/schemaTherapy/guide';
import type { GuideHintView } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide';
import type { GuideNotes } from '../../../../../shared/src/therapy/conceptGraph/guideHistory';
import type { SheetLook } from '../../../../../shared/src/theme/entityLook';
import { SignHero } from '../../paper/SignHero';
import { Disclosure, DS_FOLD } from '../../../../../shared/src/components/Disclosure';
import { ConceptFullscreenSheet, type SheetBack } from '../ConceptFullscreenSheet';
import { GuideBetweenSessions } from './GuideBetweenSessions';
import { GuideSection } from './GuideSection';
import { GuideSources } from './GuideSources';
import type { PlanSeed } from './guidePlan';
import { GuidePoints, GuideVoice } from './GuidePoints';
import { GuideMoreTechniques, GuideTechniques } from './GuideTechniques';
import '../../../styles/therapist-guide.css';

/** Ширина колонки листа подсказок на планшете (на телефоне лист уже, на компьютере — панель справа): строка ~70 знаков,
 *  а не во всю ширину окна. То же число — max-width у .gd-page (therapist-guide.css). */
const GUIDE_COLUMN = 680;

/** Раздел под «Подробнее»: подпись и абзац или своё содержимое (копинг схемы). Пустой не рисуется. */
export interface GuideMorePart { title: string; text?: string; children?: ReactNode; address?: string }

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
 * «Подробнее» (закрыто по умолчанию, Disclosure) и мелко «Источники». Шапка и
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
            <Disclosure classes={DS_FOLD} title="Подробнее">
              {items.length > 0 && <GuidePoints items={items} />}
              {parts.map((p) => <GuideSection key={p.title} title={p.title} text={p.text} address={p.address}>{p.children}</GuideSection>)}
            </Disclosure>
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
  /** «В план» у рубрик листа; нет — лист без этих кнопок. */
  onPlan?: (seed: PlanSeed) => void;
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
  /** Адрес раздела статьи по пути (articleAddress): «Про клиента» у общих разделов листа. */
  at: (path: string) => string;
  view: GuideHintView & { guide: { stuck?: string; sources: string; more?: string[] } };
};

/**
 * Лист раздела справочника (#995) — режима или схемы: каркас GuidePage, «Как это
 * звучит», свои разделы листа, затем общий хвост — «На сессии» (тап по технике →
 * лист техники поверх), свёрнутые «Ещё техники» (GuideTechniques.tsx), «Между сессиями» с «Дать заданием»; «Где застревают» —
 * последним разделом «Подробнее». У техники и задания — история серым (`notes`,
 * guideHistory.ts), за «делали …» — «журнал →» (`onOpenJournal`); `backRef` идёт
 * в каркас (GuidePage). Пустой раздел не рисуется.
 */
export function GuideSheet({ view, voice, at, moreParts = [], onOpenTechnique, onAssign, onPlan, onClose, notes, onOpenJournal, children, ...page }: Props) {
  const { guide, techniques, moreTechniques = [] } = view;
  return (
    <GuidePage
      {...page} onClose={onClose} sources={guide.sources} more={guide.more}
      moreParts={[...moreParts, { title: 'Где застревают', text: guide.stuck, address: at('stuck') }]}
    >
      <GuideVoice lines={voice} address={at('voice')} />
      {children}
      <GuideTechniques techniques={techniques} address={at('techniques')} onOpen={onOpenTechnique} onPlan={onPlan} notes={notes} onOpenJournal={onOpenJournal} />
      <GuideMoreTechniques techniques={moreTechniques} address={at('moreTechniques')} onOpen={onOpenTechnique} notes={notes} onOpenJournal={onOpenJournal} />
      <GuideBetweenSessions items={guide.betweenSessions} address={at('betweenSessions')} onAssign={onAssign} onPlan={onPlan} notes={notes} />
    </GuidePage>
  );
}
