import { Pebbles, Ribbon, Strokes } from '../art/PaperArt';

// Три действия приложения и их мотивы (docs/design/PAPER_2026-11.md): трекер — полоски,
// «Что случилось» — лента, дневник — камешки.
const ART = { Трекер: Strokes, 'Что случилось': Ribbon, Дневник: Pebbles } as const;

const ACTIONS: [keyof typeof ART, string][] = [
  ['Трекер', 'Пять потребностей, один вопрос за раз. Через 3–5 дней виден паттерн: что питает, что истощает, чего не хватает.'],
  ['Что случилось', 'Момент, после которого стало не по себе. Приложение подскажет, на какой режим это похоже и что поможет сейчас.'],
  ['Дневник', 'Одна мысль, схема, режим или спасибо. Записи собираются в одну картину: со временем видно, что повторяется.'],
];

/** Герой листа «Зачем это всё»: три мотива в ряд. */
export function WhyHero() {
  return <div className="cw-hero" aria-hidden="true"><Strokes size="square" /><Ribbon size="square" /><Pebbles size="square" /></div>;
}

/** Три строки-действия: мотив слева, название и пояснение справа. */
export function WhyActions() {
  return (
    <ul className="ds-card ds-card--flush cw-list">
      {ACTIONS.map(([title, text]) => {
        const Art = ART[title];
        return (
          <li key={title} className="ds-list-row cw-item">
            <span className="pp-row-art"><Art size="row" /></span>
            <span className="cw-item-body"><span className="ds-list-title">{title}</span><span className="cw-item-text">{text}</span></span>
          </li>
        );
      })}
    </ul>
  );
}
