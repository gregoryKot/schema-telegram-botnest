// Силуэты разделов кабинета по форме экрана (правило «скелетон по форме контента»): одни на первую
// загрузку оболочки (AppShellSkeleton) и на загрузку раздела (Suspense в AppSections) — экран не
// прыгает дважды. «Сегодня» клиента — из тех же классов, что HomeTiles (блок трекера с его знаком
// без данных, два листа бумаги), высоты строк — по шапке и трекеру экрана (shell-skeletons.css, сверка
// наложением снимков: допуск 8px); «Ещё» — заголовок, лист и строки со знаком; терапевт — «Сегодня»
// (место сцены Talk, три счётчика тоном панели, как загрузка самого экрана, колонки по его сетке) и
// карточка клиента (шапка, вкладки, две колонки «Обзора»). TherapistTodaySkeleton и ClientCardSkeleton
// берут и сами экраны терапевта (b29, b30): бумагу счётчиков силуэт включит вместе с экраном b29.
// Стили — styles/shell-skeletons.css: «Сегодня» живёт в ленивом чанке, его CSS к силуэту ещё не приехал.
import type { ReactNode } from 'react';
import { hueStyle } from '../lib/tone';
import { Strokes } from './art/PaperArt';
import { Skeleton, ScreenSkeleton } from './Skeleton';
import { DiaryFeedSkeleton } from '../sections/diary/DiaryFeedSkeleton';
import '../styles/shell-skeletons.css';
/** Знак трекера без данных: пять пустых мест, как у неоценённого дня главной (правило .pp-strokes-values). */
const EMPTY_DAY = [null, null, null, null, null];

function Head({ title = '60%' }: { title?: string }) {
  return (
    <div className="sks-head">
      <Skeleton width={150} height={12} />
      <Skeleton width={title} height={36} radius={10} />
    </div>
  );
}
/** Строка текста высотой строки экрана (sks-line--*): плашки по числу строк, лишние прячет CSS. */
function Line({ kind, bars, h }: { kind: string; bars: (number | string)[]; h: number }) {
  return <span className={`sks-line sks-line--${kind}`}>{bars.map((w, i) => <Skeleton key={i} width={w} height={h} radius={h > 16 ? 8 : 6} />)}</span>;
}
/** Лист бумаги оттенка `h` с подписью-плашкой сверху (силуэт листа карточки клиента). */
const Sheet = ({ h, children }: { h: number; children: ReactNode }) => <div className="pp-paper sks-paper sks-sheet" style={hueStyle(h)}><Skeleton width={110} height={11} />{children}</div>;
/** Строки списка со знаком слева (лента, «Ещё», клиенты). */
function Rows({ n, art = 44 }: { n: number; art?: number }) {
  return (
    <div className="sks-rows">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="sks-row">
          <Skeleton width={art} height={art === 44 ? 24 : art} radius={art === 44 ? 8 : art / 2} />
          <div className="sks-col"><Skeleton width={`${62 - (i % 3) * 12}%`} height={14} /><Skeleton width="78%" height={11} /></div>
        </div>
      ))}
    </div>
  );
}
/** «Сегодня» клиента: шапка (дата в строке «Зачем это?», приветствие), блок трекера и два квадрата бумаги. */
export function ClientTodaySkeleton() {
  return (
    <div className="ds-page sks-page sks-today" data-testid="today-skeleton">
      <div className="sks-head sks-head--today"><Line kind="top" bars={[150]} h={12} /><Line kind="h1" bars={['60%']} h={36} /></div>
      <div className="sks-today-home">
        <div className="pp-block sks-paper sks-today-main" style={hueStyle(70)}>
          <div className="pp-hero">
            <div className="sks-col">
              <Line kind="label" bars={[56]} h={11} />
              <Line kind="title" bars={['82%', '56%']} h={26} />
              <Line kind="text" bars={['92%', '48%']} h={13} />
              <Line kind="meta" bars={['44%']} h={12} />
            </div>
            <span className="sks-strokes"><Strokes size="hero" values={EMPTY_DAY} /></span>
          </div>
          <Skeleton height={48} radius={24} />
        </div>
        <div className="pp-squares">
          {[135, 45].map(h => (
            <div key={h} className="pp-paper sks-paper pp-square sks-square" style={hueStyle(h)}>
              <Line kind="sq-title" bars={['80%', '52%']} h={22} />
              <Line kind="sq-text" bars={['88%', '56%']} h={12} />
              <Line kind="sq-foot" bars={['44%']} h={12} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** «Ещё»: заголовок, лист «Терапия» и список разделов со знаком слева. */
export function MoreSkeleton() {
  return (
    <div className="ds-page sks-page" data-testid="more-skeleton">
      <Head title="70%" />
      <div className="pp-paper sks-paper sks-sheet" style={hueStyle(70)}>
        <Skeleton width={72} height={11} />
        <Skeleton width="86%" height={22} radius={8} />
        <Skeleton width={180} height={44} radius={22} />
      </div>
      <div className="sks-card"><Rows n={5} /></div>
    </div>
  );
}

/** «Сегодня» терапевта: приветствие и место сцены Talk, три счётчика, колонки «Сессии», «Внимание», «Активность». */
export function TherapistTodaySkeleton() {
  return (
    <div className="ds-page sks-page sks-wide" data-testid="therapist-today-skeleton">
      <div className="pp-block pp-block--head">
        <div className="pp-hero">
          <div className="sks-col"><Line kind="label" bars={[150]} h={12} /><Line kind="th-title" bars={['80%', '50%']} h={30} /></div>
          <span className="pp-art--hero sks-scene"><Skeleton height="100%" radius={18} /></span>
        </div>
      </div>
      <div className="sks-counters">{[0, 1, 2].map(i => <Skeleton key={i} height="100%" radius={16} />)}</div>
      <div className="sks-two sks-two--today">
        <div className="sks-col"><Skeleton width="46%" height={22} /><div className="sks-card"><Rows n={2} art={32} /></div></div>
        <div className="sks-col"><Skeleton width="52%" height={22} /><div className="sks-card"><Rows n={3} art={32} /></div></div>
      </div>
    </div>
  );
}

/** Карточка клиента (b30): круг и имя, мета, вкладки; «Обзор» — цель (солома) и группа схем, «Встречи» (небо) и трекер. */
export function ClientCardSkeleton() {
  return (
    <div className="ds-page sks-page sks-wide" data-testid="client-card-skeleton">
      <Skeleton width={110} height={13} />
      <div className="sks-card-head">
        <Skeleton width={56} height={56} radius={28} />
        <div className="sks-col"><Skeleton width="44%" height={30} radius={8} /><Skeleton width="62%" height={12} /></div>
      </div>
      <div className="sks-tabs">{[64, 120, 112, 64, 72, 56].map((w, i) => <Skeleton key={i} width={w} height={14} />)}</div>
      <div className="sks-two sks-two--overview">
        <div className="sks-col"><Sheet h={70}><Skeleton width="86%" height={22} /><Skeleton width="58%" height={22} /></Sheet><Sheet h={28}><div className="sks-card"><Rows n={2} /></div></Sheet></div>
        <div className="sks-col"><Sheet h={240}><Skeleton width="70%" height={20} /><Skeleton width="50%" height={14} /></Sheet><Sheet h={70}><Skeleton width={64} height={40} radius={8} /></Sheet></div>
      </div>
    </div>
  );
}

/** Силуэт раздела по адресу: «Сегодня», «Записи» и «Ещё» клиента, «Сегодня» и карточка терапевта, остальное — общий. */
export function SectionSkeleton({ pathname, therapistMode }: { pathname: string; therapistMode: boolean }) {
  if (therapistMode) {
    if (pathname === '/cabinet/today') return <TherapistTodaySkeleton />;
    const card = /^\/cabinet\/(?!guide$|tasks$)[^/]+/.test(pathname);
    return card ? <ClientCardSkeleton /> : <ScreenSkeleton />;
  }
  const seg = pathname.split('/')[1] || 'today';
  if (seg === 'today') return <ClientTodaySkeleton />;
  if (seg === 'more') return <MoreSkeleton />;
  return seg === 'diary' ? <DiaryFeedSkeleton /> : <ScreenSkeleton />;
}

/** Нижняя панель телефона в силуэте (на ≥768 скрыта правилом .mobile-nav): пять или три места, без прыжка. */
export function MobileNavSkeleton({ therapist }: { therapist: boolean }) {
  return (
    <div className="mobile-nav sks-mobile-nav" aria-hidden="true">
      {Array.from({ length: therapist ? 5 : 3 }, (_, i) => (
        <span key={i} className="sks-mobile-nav-item"><Skeleton width={30} height={18} radius={6} /><Skeleton width={44} height={9} /></span>
      ))}
    </div>
  );
}
