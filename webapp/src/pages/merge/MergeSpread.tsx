import { lazy, Suspense, type CSSProperties, type ReactNode } from 'react';
import { ProductBrand } from '../../components/paper/ProductBrand';
import '../../styles/auth-account.css';

// Сцена — своим чанком (принцип 11): место под неё зарезервировано рамкой листа (.am-hero, пропорция
// холста сцены), поэтому вёрстка не прыгает, когда рисунок догрузится.
const SceneMerge = lazy(() => import('../../components/art/SceneMerge'));

// Экран-решение /link и /account/merge (docs/design/APP_2026-11.md, принцип 4: «поток = лист-герой +
// форма»): лист неба (граница и доступ — 240) со сценой SceneMerge сверху, на ≥1024 — слева, форма —
// справа. Корень сам красит экран (light-lock) и растягивается на всю ширину ряда #root (flex: 1).
// Обращений к читателю не содержит: тексты передаёт страница.
export function MergeSpread({ children }: { children: ReactNode }) {
  return (
    <div className="light-lock am-root" style={{ '--h': 240 } as CSSProperties}>
      <div className="am-spread">
        <ProductBrand plate className="am-brand" />
        <div className="am-hero">
          <Suspense fallback={null}><SceneMerge hue={240} /></Suspense>
        </div>
        <div className="am-form">{children}</div>
      </div>
    </div>
  );
}
