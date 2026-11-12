// Пропсы героя «Моего пути» — вёрстку даёт площадка в составе `kit` (journeyKit.ts):
// shared не импортирует webapp. Данные и расчёты (total, explainer) — общие, из JourneyView.
export interface JourneyHeroProps {
  total: number;
  explainer: string;
  onShareFeed: () => void;
}
export interface JourneyEmptyHeroProps {
  tr: (ty: string, vy: string) => string;
  explainer: string;
}
