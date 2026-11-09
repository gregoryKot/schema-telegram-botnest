// Силуэты разделов кабинета по форме экрана (правило «скелетон по форме контента»): одни на первую
// загрузку оболочки (AppShellSkeleton) и на загрузку раздела (Suspense в AppSections) — экран не
// прыгает дважды. «Сегодня» клиента — из тех же классов, что HomeTiles (блок трекера с его знаком
// без данных, два листа бумаги); «Ещё» — заголовок, лист и строки со знаком; терапевт — «Сегодня»
// (три плитки счётчиков, две колонки) и карточка клиента (шапка, вкладки, две колонки «Обзора»).
// TherapistTodaySkeleton и ClientCardSkeleton берут и сами экраны терапевта (b29, b30).
// Стили — styles/shell-skeletons.css: «Сегодня» живёт в ленивом чанке, его CSS к силуэту ещё не приехал.
import type { CSSProperties } from 'react';
import { Strokes } from './art/PaperArt';
import { Skeleton, SkeletonList, ScreenSkeleton } from './Skeleton';
import '../styles/shell-skeletons.css';

const hue = (h: number) => ({ '--h': h }) as CSSProperties;
/** Знак трекера без данных: пять полосок пустым тоном бумаги — как у неоценённого дня, ничего выдуманного. */
const EMPTY_DAY = [null, null, null, null, null];

function Head({ title = '60%' }: { title?: string }) {
  return (
    <div className="sks-head">
      <Skeleton width={150} height={12} />
      <Skeleton width={title} height={36} radius={10} />
    </div>
  );
}

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

/** «Сегодня» клиента: шапка, блок трекера (подпись, вопрос, знак, кнопка) и два квадрата бумаги. */
export function ClientTodaySkeleton() {
  return (
    <div className="ds-page sks-page sks-today" data-testid="today-skeleton">
      <Head />
      <div className="sks-today-home">
        <div className="pp-block sks-today-main" style={hue(70)}>
          <div className="pp-hero">
            <div className="sks-col sks-col--hero">
              <Skeleton width={56} height={11} />
              <Skeleton width="82%" height={30} radius={8} />
              <Skeleton width="92%" height={13} />
              <Skeleton width="48%" height={13} />
            </div>
            <span className="sks-strokes"><Strokes size="hero" values={EMPTY_DAY} /></span>
          </div>
          <Skeleton height={52} radius={26} />
        </div>
        <div className="pp-squares">
          {[135, 45].map(h => (
            <div key={h} className="pp-paper pp-square sks-square" style={hue(h)}>
              <Skeleton width="72%" height={24} radius={8} />
              <Skeleton width="88%" height={12} />
              <Skeleton width="56%" height={12} />
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
      <div className="pp-paper sks-sheet" style={hue(70)}>
        <Skeleton width={72} height={11} />
        <Skeleton width="86%" height={22} radius={8} />
        <Skeleton width={180} height={44} radius={22} />
      </div>
      <div className="sks-card"><Rows n={5} /></div>
    </div>
  );
}

/** «Сегодня» терапевта: приветствие, три плитки счётчиков (бумага встреч, клиентов, внимания), две колонки. */
export function TherapistTodaySkeleton() {
  return (
    <div className="ds-page sks-page sks-wide" data-testid="therapist-today-skeleton">
      <Head title="54%" />
      <div className="sks-counters">
        {[135, 240, 45].map(h => (
          <div key={h} className="pp-paper sks-counter" style={hue(h)}>
            <Skeleton width={44} height={34} radius={8} />
            <Skeleton width="64%" height={11} />
          </div>
        ))}
      </div>
      <div className="sks-two">
        <div className="sks-col"><Skeleton width="46%" height={22} /><div className="sks-card"><Rows n={2} art={32} /></div></div>
        <div className="sks-col"><Skeleton width="52%" height={22} /><div className="sks-card"><Rows n={3} art={32} /></div></div>
      </div>
    </div>
  );
}

/** Карточка клиента: круг и имя, строка меты, ряд вкладок, две колонки «Обзора». */
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
        <div className="sks-col"><div className="sks-card sks-card--pad"><SkeletonList rows={1} height={64} /></div><div className="sks-card sks-card--pad"><SkeletonList rows={2} height={48} /></div></div>
        <div className="sks-col"><div className="pp-paper sks-sheet" style={hue(240)}><Skeleton width={96} height={11} /><Skeleton width="70%" height={20} /></div><div className="sks-card sks-card--pad"><SkeletonList rows={3} height={20} gap={12} /></div></div>
      </div>
    </div>
  );
}

/** Силуэт раздела по адресу: «Сегодня» и «Ещё» клиента, «Сегодня» и карточка терапевта, остальное — общий. */
export function SectionSkeleton({ pathname, therapistMode }: { pathname: string; therapistMode: boolean }) {
  if (therapistMode) {
    if (pathname === '/cabinet/today') return <TherapistTodaySkeleton />;
    const card = /^\/cabinet\/(?!guide$|tasks$)[^/]+/.test(pathname);
    return card ? <ClientCardSkeleton /> : <ScreenSkeleton />;
  }
  const seg = pathname.split('/')[1] || 'today';
  if (seg === 'today') return <ClientTodaySkeleton />;
  if (seg === 'more') return <MoreSkeleton />;
  return <ScreenSkeleton />;
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
