// Силуэт карточки клиента по форме экрана (r1, L5): шапка той же высоты, что tk-head (телефон 219, компьютер 232),
// и тело вкладки по сетке «Обзора» (tk-ov: колонка и сайдбар clamp(260px, 30%, 340px), с 1024). Одна форма на
// загрузку раздела (ClientCardSkeleton оболочки), на загрузку списка (ClientCardFallback) и на загрузку данных
// вкладки (TherapistClientSheet, бывший .tk-load с контурными прямоугольниками) — силуэт не меняется третьей формой.
// Стили — styles/shell-skeletons.css (главный чанк: CSS карточки к силуэту ещё не приехал).
import type { ReactNode } from 'react';
import { hueStyle } from '../../lib/tone';
import { Skeleton } from '../Skeleton';
import '../../styles/shell-skeletons.css';

const Sheet = ({ h, cls, children }: { h: number; cls: string; children: ReactNode }) => (
  <div className={`pp-paper sks-paper sks-sheet ${cls}`} style={hueStyle(h)}><Skeleton width={110} height={11} />{children}</div>
);

/** Шапка: «← Все клиенты» и «⋯», круг и имя с метой, полоса вкладок. */
export function CardHeadSkeleton() {
  return (
    <div className="sks-card-top">
      <div className="sks-card-back"><Skeleton width={110} height={13} /><Skeleton width={44} height={44} radius={22} /></div>
      <div className="sks-card-head">
        <Skeleton width={56} height={56} radius={28} />
        <div className="sks-col"><Skeleton width="44%" height={28} radius={8} /><Skeleton width="62%" height={12} /><Skeleton width="38%" height={12} /></div>
      </div>
      <div className="sks-tabs">{[64, 120, 112, 64, 72, 56].map((w, i) => <Skeleton key={i} width={w} height={14} />)}</div>
    </div>
  );
}

/** Тело «Обзора»: кнопки (на телефоне — первой строкой), цель — солома, подпись и группа схем; сайдбар —
 *  «Встречи» (небо) и трекер (солома). Другие вкладки — тот же отступ колонки и белые листы без обводки. */
export function OverviewSkeleton({ tab = 'overview' }: { tab?: string }) {
  if (tab !== 'overview') {
    return (
      <div className="sks-ov sks-ov--tab">
        <div className="sks-col">{[96, 160].map((h) => <div key={h} className="sks-leaf" style={{ height: h }} />)}</div>
      </div>
    );
  }
  return (
    <div className="sks-ov">
      <div className="sks-col">
        <div className="sks-ov-quick"><Skeleton width={104} height={44} radius={22} /><Skeleton width={104} height={44} radius={22} /></div>
        <Sheet h={70} cls="sks-ov-goal"><Skeleton width="86%" height={20} /><Skeleton width="72%" height={20} /><Skeleton width="58%" height={20} /></Sheet>
        <Skeleton width={120} height={12} />
        <Sheet h={28} cls="sks-ov-group"><div className="sks-card"><div className="sks-rows">{[0, 1, 2].map((i) => <div key={i} className="sks-row sks-row--tight"><Skeleton width={`${70 - i * 12}%`} height={14} /></div>)}</div></div></Sheet>
      </div>
      <div className="sks-col">
        <Sheet h={240} cls="sks-ov-meet"><Skeleton width="70%" height={22} /><Skeleton width="50%" height={14} /></Sheet>
        <Sheet h={70} cls="sks-ov-track"><Skeleton width={64} height={40} radius={8} /></Sheet>
      </div>
    </div>
  );
}
