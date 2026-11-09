import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { glue } from '../../../../shared/src/utils/typo';
import { hueStyle } from '../../lib/tone';
import { WhySign } from './WhySign';

// Три действия приложения — те же листы цветной бумаги и знаки, что квадраты главной «Сегодня»
// (ENTITY_LOOK: трекер — солома и полоски, «Что случилось» — шалфей и лента, дневник — персик и
// камешки). Лист рассказывает, а не ведёт: не кнопка, без стрелки. Телефон — плитки вширь, знак
// справа; компьютер — три в ряд, знак сверху (client-why.css). Короткие предлоги не висят в конце строки
// (glue при отрисовке, слова те же).
const THINGS = [
  ['tracker', 'Трекер', 'Пять потребностей, один вопрос за раз. Через 3–5 дней виден паттерн: что питает, что истощает, чего не хватает.'],
  ['case', 'Что случилось', 'Момент, после которого стало не по себе. Приложение подскажет, на какой режим это похоже и что поможет сейчас.'],
  ['diary', 'Дневник', 'Одна мысль, схема, режим или спасибо. Записи собираются в одну картину: со временем видно, что повторяется.'],
] as const;

export function WhyThree() {
  return (
    <ul className="cw-three">
      {THINGS.map(([entity, title, text]) => {
        const { hue, sign } = ENTITY_LOOK[entity];
        return (
          <li key={entity} className="pp-paper cw-thing" style={hueStyle(hue)}>
            <h2 className="pp-title cw-thing-title">{title}</h2>
            <p className="pp-text cw-thing-text">{glue(text)}</p>
            <WhySign sign={sign} size="square" />
          </li>
        );
      })}
    </ul>
  );
}
