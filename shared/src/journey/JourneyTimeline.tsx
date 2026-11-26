// Лента «Моего пути»: группы по месяцам (заголовок спокойной подписью), строка — знак сущности шага
// на её бумаге (rowArt от площадки, journeyLook.ts), название, дата тоном --text-sub и шеврон SVG.
// Строка открывает шаг целиком (деталь, «Поделиться карточкой»). Одна копия (правило №3); без rowArt
// строка рисуется без картинки — эмодзи journeyMeta сюда не идут. Классы — webapp/src/styles/journey.css.
import type { ReactNode } from 'react';
import {
  type JourneyItem,
  type JourneyMonthGroup,
  formatJourneyDay,
  journeyTypeMeta,
} from './journeyMeta';

export interface JourneyTimelineProps {
  groups: JourneyMonthGroup[];
  subtitle: (item: JourneyItem) => string | null;
  onOpenItem: (item: JourneyItem) => void;
  /** Знак строки (webapp: SignArt по journeyItemLook на бумаге сущности). */
  rowArt?: (item: JourneyItem) => ReactNode;
}

/** Шеврон строки-перехода — SVG, а не глиф «›». */
export const JourneyChevron = () => (
  <svg
    className="jr-chev"
    viewBox="0 0 8 14"
    width="8"
    height="14"
    aria-hidden="true"
  >
    <path
      d="M1.5 1.5 6.5 7l-5 5.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function JourneyTimeline({
  groups,
  subtitle,
  onOpenItem,
  rowArt,
}: JourneyTimelineProps) {
  return (
    <div className="jr-feed">
      {groups.map((g) => (
        <section key={g.key} className="jr-month">
          <h3 className="ds-label jr-month-title">{g.label}</h3>
          <div className="jr-rows">
            {g.items.map((item, i) => {
              const meta = journeyTypeMeta(item.type);
              const sub = subtitle(item);
              return (
                <button
                  type="button"
                  key={`${item.type}-${item.at}-${i}`}
                  className="jr-row"
                  onClick={() => onOpenItem(item)}
                  aria-label={`Открыть: ${meta.label}`}
                >
                  {rowArt?.(item)}
                  <span className="jr-row-text">
                    <span className="jr-row-title">{meta.label}</span>
                    <span className="jr-row-sub">
                      {formatJourneyDay(item.at)}
                      {sub ? ` · ${sub}` : ''}
                    </span>
                  </span>
                  <JourneyChevron />
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
