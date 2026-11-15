// Силуэт «Практик» по форме раздела (SectionSkeleton по адресу /practice; до него — общий ScreenSkeleton): шапка,
// вводная «Здесь и сейчас», герой дыхания, квадраты быстрых практик и бенто библиотеки. Тихая бумага — в оттенках
// героя и квадратов из ENTITY_LOOK (их набор и порядок постоянны); плитки библиотеки без оттенка: набор и порядок
// настраивает человек, чужой цвет мигал бы до экрана. Раскладка — client-practice-skeleton.css: силуэт рисуется
// до чанка «Практик», и их CSS к нему ещё не приехал.
import type { CSSProperties } from 'react';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { hueStyle } from '../../lib/tone';
import { Skeleton, SkeletonLines } from '../../components/Skeleton';
import '../../styles/client-practice-skeleton.css';

/** Оттенки квадратов по порядку: заземление, «Стоп», «Мне плохо» (его квадрат — только на компьютере). */
const SQUARE_HUES = [ENTITY_LOOK.grounding.hue, ENTITY_LOOK.stop.hue, ENTITY_LOOK.sos.hue];

/** Лист со знаком: квадрат быстрой практики или плитка библиотеки (у плитки знак сверху — в CSS). */
function Leaf({ className, style }: { className: string; style?: CSSProperties }) {
  return (
    <div className={className} style={style}>
      <SkeletonLines widths={['84%', '56%']} height={22} gap={10} />
      <SkeletonLines widths={['92%', '62%']} gap={12} />
      <Skeleton className="cpk-sign" height="auto" radius={14} />
      <Skeleton className="cpk-foot" width="44%" height={12} />
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
        <span className="cpk-h2"><Skeleton width={220} height="100%" /></span>
        <SkeletonLines widths={['95%', '91%', '93%', '34%']} gap={9} />
        <div className="pp-paper sks-paper cpk-hero" style={hueStyle(ENTITY_LOOK.breathing.hue)}>
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
        <div className="pp-squares cpk-squares">
          {SQUARE_HUES.map((h) => <Leaf key={h} className="pp-paper sks-paper pp-square cpk-sq" style={hueStyle(h)} />)}
        </div>
      </div>
      <div className="cpk-lib-block">
        <div className="ds-head-row"><Skeleton width={170} height={26} /><Skeleton width={104} height={12} /></div>
        <div className="cpk-lib">{Array.from({ length: 6 }, (_, i) => <Leaf key={i} className="cpk-ex" />)}</div>
      </div>
    </div>
  );
}
