import { DIARY_HUE, hueStyle } from '../../lib/tone';
import '../../styles/sheet-diary.css';
import { useTr } from '../../utils/addressForm';
import {
  buildDiaryExplainers,
  DIARY_HUB_INTRO,
} from '../../../../shared/src/diary/diaryExplainers';
import type { DiaryFilter } from '../../sections/diary/diaryModel';

// Пустая лента «Записей»: вместо «Пусто.» ответ «что это и зачем» (правило онбординга).
// Контент дневников — общий buildDiaryExplainers, как в мини-аппе (правило №3).
const TITLE: Record<DiaryFilter, string> = {
  all: 'Пока ни одной записи',
  diary: 'Записей дневника пока нет',
  case: 'Разборов пока нет',
  tracker: 'Отметок трекера пока нет',
};
const CASE_INTRO = 'Разбор — три коротких вопроса про момент, когда что-то зацепило. Через 2–3 разбора видно, что повторяется.';
const TRACKER_INTRO = 'Трекер — пять коротких вопросов про базовые потребности, минута в день. Через 3–5 дней видно, что питает, а чего не хватает.';

const INTRO: Record<Exclude<DiaryFilter, 'diary'>, string> = { all: DIARY_HUB_INTRO, tracker: TRACKER_INTRO, case: CASE_INTRO };
const FOOT: Record<DiaryFilter, string> = {
  all: 'Первая запись — кнопка «Записать» выше, пара минут.',
  diary: 'Первая запись — кнопка «Записать» выше, пара минут.',
  tracker: 'Первая отметка — плитка «Трекер» на главной.',
  case: 'Первый разбор — плитка «Что случилось» на главной.',
};

export function DiaryEmptyExplainer({ filter }: { filter: DiaryFilter }) {
  const explainers = buildDiaryExplainers(useTr());
  const types = filter === 'tracker' || filter === 'case' ? [] : (['schema', 'mode'] as const);

  return (
    <div className="sd-explainer-wrap">
      <div className="ds-h2 sd-explainer-title">{TITLE[filter]}</div>
      {filter !== 'diary' && <div className="sd-explainer-intro">{INTRO[filter]}</div>}
      {types.map((type) => (
        <div key={type} className="ds-card ds-card--row tone-soft sd-explainer-card" style={hueStyle(DIARY_HUE[type])}>
          <div>{explainers[type].what}</div>
          <div className="ds-sub sd-explainer-why">{explainers[type].why}</div>
        </div>
      ))}
      <div className="sd-explainer-foot">
        {FOOT[filter]}
      </div>
    </div>
  );
}
