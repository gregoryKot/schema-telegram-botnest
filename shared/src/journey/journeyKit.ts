// Вёрстка «Моего пути» от площадки — пропсом `kit` в JourneyView (shared не импортирует webapp):
// герой, пустой герой, плитка счётчика, чип фильтра и знак строки ленты (SignArt по journeyLook.ts).
// Пропс без дефолта: забытая передача — ошибка tsc, а не пустой экран. Сайт — webJourneyKit.ts.
import type { ComponentType, ReactNode } from 'react';
import type { JourneyEmptyHeroProps, JourneyHeroProps } from './journeyHeroes';
import type { JourneyItem } from './journeyMeta';
import type { JourneyStatRow } from './journeyStats';

export interface JourneyChipProps {
  label: string;
  on: boolean;
  onToggle: () => void;
}

export interface JourneyKit {
  Hero: ComponentType<JourneyHeroProps>;
  EmptyHero: ComponentType<JourneyEmptyHeroProps>;
  Stat: ComponentType<{ row: JourneyStatRow }>;
  Chip: ComponentType<JourneyChipProps>;
  Alert: ComponentType<{ text: string; onRetry: () => void }>; // сбой загрузки с кнопкой повтора
  rowArt?: (item: JourneyItem) => ReactNode; // знак строки ленты; без него — без картинки
}
