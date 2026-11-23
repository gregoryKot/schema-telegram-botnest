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
import { Cited } from './GuideText';
import { GuideToc } from './GuideToc';
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
 * Каркас листа подсказок (#995) — один на все листы: в шапке подпись и «Закрыть», герой (заголовок Literata, суть,
 * знак на квадратике бумаги группы или домена — SignHero), полоса-оглавление (GuideToc), свои разделы листа,
 * «Подробнее» (Disclosure) и свёрнутые «Источники». Оболочка — ConceptFullscreenSheet `panel` (useHistorySheet):
 * на компьютере — панель справа над «Справочником» или схемой случая, на телефоне — весь экран.
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
          {lede.trim() && <p className="pp-hero-text"><Cited text={lede} /></p>}
        </div>
        <GuideToc />
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
  lead?: ReactNode; related?: ReactNode; // разделы до техник; блок «Связано» после «Между сессиями»
  /** Адрес раздела статьи по пути (articleAddress): «Про клиента» у общих разделов листа. */
  at: (path: string) => string;
  view: GuideHintView & { guide: { stuck?: string; sources: string; more?: string[] } };
};

/**
 * Лист раздела справочника (#995) — режима или схемы, вариант A: каркас GuidePage, «Как это звучит», `lead` (цель или
 * потребность), «На сессии» и свёрнутые «Ещё техники» (GuideTechniques.tsx), свои разделы листа, «Между сессиями»
 * с «Дать заданием», блок «Связано» (`related`); «Где застревают» — последним в «Подробнее». История серым — `notes`.
 */
export function GuideSheet({ view, voice, lead, related, at, moreParts = [], onOpenTechnique, onAssign, onPlan, onClose, notes, onOpenJournal, children, ...page }: Props) {
  const { guide, techniques, moreTechniques = [] } = view;
  return (
    <GuidePage
      {...page} onClose={onClose} sources={guide.sources} more={guide.more}
      moreParts={[...moreParts, { title: 'Где застревают', text: guide.stuck, address: at('stuck') }]}
    >
      <GuideVoice lines={voice} address={at('voice')} />
      {lead}
      <GuideTechniques techniques={techniques} address={at('techniques')} onOpen={onOpenTechnique} onPlan={onPlan} notes={notes} onOpenJournal={onOpenJournal} />
      <GuideMoreTechniques techniques={moreTechniques} address={at('moreTechniques')} onOpen={onOpenTechnique} notes={notes} onOpenJournal={onOpenJournal} />
      {children}
      <GuideBetweenSessions items={guide.betweenSessions} address={at('betweenSessions')} onAssign={onAssign} onPlan={onPlan} notes={notes} />
      {related}
    </GuidePage>
  );
}
