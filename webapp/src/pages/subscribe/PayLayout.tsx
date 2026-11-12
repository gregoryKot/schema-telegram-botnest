// Каркас /subscribe и /donate (docs/design/APP_2026-11.md, b28; принцип 4 — лист-герой + форма): лист
// соломы (70 — подписка и донат) со сценой FinalCorners вместо одинокого Leaf, рядом форма. На ≥1024 —
// разворот SpreadLayout (лист слева, липкий), уже — лист сверху, форма под ним. «← На главную»: на
// телефоне — шапкой (ds-sheet-head/ds-back, #906), на компьютере — последней строкой колонки формы.
// Страницы публичные, без useTr: тексты безличные, их передаёт страница.
import type { CSSProperties, ReactNode } from 'react';
import '../../styles/auth-pay.css';
import { FinalCorners } from '../../components/art/SceneParts';
import { EntitySheet } from '../../components/paper/EntitySheet';
import { SpreadLayout } from '../../components/paper/SpreadLayout';
import { Skeleton } from '../../components/Skeleton';

export interface PayHeroProps { label: ReactNode; title: ReactNode; lead: ReactNode }

/** Лист-герой: надпись, h1, лид (класс ap-lead — его текст сверяют тесты формы обращения), углы сцены. */
export function PayHero({ label, title, lead }: PayHeroProps) {
  return (
    <EntitySheet look={{ hue: 70 }} label={label} title={title} titleAs="h1" sub={<span className="ap-lead">{lead}</span>} className="ap-sheet">
      <FinalCorners hue={70} />
    </EntitySheet>
  );
}

export function PayLayout({ hero, children, home = true }: { hero: ReactNode; children: ReactNode; home?: boolean }) {
  return (
    <div className="light-lock ap-page">
      <div className="ds-sheet-head ds-sheet-head--page"><a href="/" className="ds-back">← На главную</a></div>
      <SpreadLayout className="ap-main" side={hero}>
        {children}
        {home && <a href="/" className="ap-home">← На главную</a>}
      </SpreadLayout>
    </div>
  );
}

/** Загрузка — силуэт того, что придёт: лист-герой и форма (плитки тарифов, поле, кнопка) или управление
 *  (строка списания, кнопка). Подпись «Загружаем…» — для чтения с экрана, глазами виден силуэт. */
export function PaySkeleton({ shape }: { shape: 'form' | 'manage' }) {
  const hero = (
    <div className="pp-paper pa-sheet ap-sheet ap-skel-sheet" style={{ '--h': 70 } as CSSProperties}>
      <Skeleton width={96} height={12} /><Skeleton width="70%" height={30} radius={10} /><Skeleton width="85%" height={14} />
    </div>
  );
  return (
    <div className="ap-skel" role="status" aria-label="Загружаем…" aria-busy="true">
      <PayLayout hero={hero} home={false}>
        {shape === 'form'
          ? <><div className="ap-plans"><Skeleton height={104} radius={18} /><Skeleton height={104} radius={18} /></div><Skeleton height={48} radius={14} /></>
          : <Skeleton height={52} radius={14} />}
        <Skeleton height={52} radius={26} />
      </PayLayout>
    </div>
  );
}
