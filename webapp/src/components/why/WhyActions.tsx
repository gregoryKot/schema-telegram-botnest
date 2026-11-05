import { Pebbles, Ribbon, Strokes } from '../art/PaperArt';

// Три действия приложения; их мотивы (полоски, лента, камешки) — в герое сверху,
// у строк значков нет (картинка — крупный акцент, одна на экран).
const ACTIONS: [string, string][] = [
  ['Трекер', 'Пять потребностей, один вопрос за раз. Через 3–5 дней виден паттерн: что питает, что истощает, чего не хватает.'],
  ['Что случилось', 'Момент, после которого стало не по себе. Приложение подскажет, на какой режим это похоже и что поможет сейчас.'],
  ['Дневник', 'Одна мысль, схема, режим или спасибо. Записи собираются в одну картину: со временем видно, что повторяется.'],
];

/** Герой листа «Зачем это всё»: три мотива в ряд. */
export function WhyHero() {
  return <div className="cw-hero" aria-hidden="true"><Strokes size="square" /><Ribbon size="square" /><Pebbles size="square" /></div>;
}

/** Три строки-действия: название и пояснение. */
export function WhyActions() {
  return (
    <ul className="ds-card ds-card--flush cw-list">
      {ACTIONS.map(([title, text]) => (
        <li key={title} className="ds-list-row cw-item">
          <span className="cw-item-body"><span className="ds-list-title">{title}</span><span className="cw-item-text">{text}</span></span>
        </li>
      ))}
    </ul>
  );
}
