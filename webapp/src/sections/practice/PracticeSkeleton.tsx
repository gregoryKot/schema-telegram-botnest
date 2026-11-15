// Силуэт «Практик» по форме раздела (SectionSkeleton по адресу /practice; до него — общий ScreenSkeleton): шапка,
// вводная «Здесь и сейчас», герой дыхания, квадраты быстрых практик и бенто библиотеки. Тихая бумага — в оттенках
// героя и квадратов (их набор и порядок постоянны, сверка с QUICK_LOOK и PRACTICE_LOOK — в тесте); плитки
// библиотеки без оттенка: набор и порядок настраивает человек, чужой цвет мигал бы до экрана. Раскладка —
// client-practice-skeleton.css: силуэт рисуется до чанка «Практик», и их CSS к нему ещё не приехал.
import { hueStyle } from '../../lib/tone';
import { Skeleton, SkeletonLines } from '../../components/Skeleton';
import '../../styles/client-practice-skeleton.css';

/** Оттенки квадратов по порядку: заземление, «Стоп», «Мне плохо» (его квадрат — только на компьютере). */
const SQUARE_HUES = [135, 70, 25];
const BREATH_HUE = 195;

function Square({ hue }: { hue: number }) {
  return (
    <div className="pp-paper sks-paper pp-square cpk-sq" style={hueStyle(hue)}>
      <SkeletonLines widths={['84%', '58%']} height={22} gap={10} />
      <SkeletonLines widths={['92%', '64%']} gap={12} />
      <Skeleton className="cpk-sign" height="auto" radius={14} />
      <Skeleton className="cpk-foot" width="44%" height={12} />
    </div>
  );
}

function Tile() {
  return (
    <div className="cpk-ex">
      <Skeleton className="cpk-ex-sign" height="auto" radius={14} />
      <SkeletonLines widths={['78%', '50%']} height={20} gap={8} />
      <SkeletonLines widths={['90%', '62%']} />
      <Skeleton className="cpk-foot" width="40%" height={12} />
    </div>
  );
}

export function PracticeSkeleton() {
  return (
    <div aria-hidden="true" className="ds-page cpk-page" data-testid="practice-skeleton">
      <div className="cpk-head">
        <Skeleton width={84} height={12} />
        <span className="cpk-h1"><Skeleton width="56%" height="100%" radius={10} /></span>
        <Skeleton width="44%" height={13} />
      </div>
      <div className="cpk-here">
        <span className="cpk-h2 cpk-desk"><Skeleton width={220} height="100%" /></span>
        <div className="cpk-desk"><SkeletonLines widths={['95%', '91%', '93%', '34%']} gap={9} /></div>
        <div className="cpk-phone">
          <SkeletonLines widths={['96%', '58%']} gap={9} />
          <span className="cpk-link"><Skeleton width={190} height={16} /></span>
        </div>
        <div className="pp-paper sks-paper cpk-hero" style={hueStyle(BREATH_HUE)}>
          <div className="cpk-hero-in">
            <Skeleton className="cpk-scene" height="auto" radius={20} />
            <div className="cpk-hero-body">
              <Skeleton className="cpk-hero-label" width={104} height={11} />
              <Skeleton className="cpk-hero-title" width="72%" height={34} radius={10} />
              <SkeletonLines widths={['92%', '84%', '46%']} height={13} gap={10} />
              <Skeleton className="cpk-hero-btn" height={48} radius={24} />
            </div>
          </div>
        </div>
        <div className="pp-squares cpk-squares">{SQUARE_HUES.map((h) => <Square key={h} hue={h} />)}</div>
      </div>
      <div className="cpk-lib-block">
        <div className="ds-head-row"><Skeleton width={170} height={26} /><Skeleton width={104} height={12} /></div>
        <div className="cpk-lib">{Array.from({ length: 6 }, (_, i) => <Tile key={i} />)}</div>
      </div>
    </div>
  );
}
