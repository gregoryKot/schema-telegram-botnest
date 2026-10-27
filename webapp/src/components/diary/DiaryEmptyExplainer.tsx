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
  tracker: 'Отметок трекера пока нет',
};
const TRACKER_INTRO = 'Трекер — пять коротких вопросов про базовые потребности, минута в день. Через 3–5 дней видно, что питает, а чего не хватает.';

export function DiaryEmptyExplainer({ filter }: { filter: DiaryFilter }) {
  const explainers = buildDiaryExplainers(useTr());
  const types = filter === 'tracker' ? [] : (['schema', 'mode'] as const);

  return (
    <div className="sd-explainer-wrap">
      <div className="ds-h2 sd-explainer-title">{TITLE[filter]}</div>
      {filter !== 'diary' && <div className="sd-explainer-intro">{filter === 'all' ? DIARY_HUB_INTRO : TRACKER_INTRO}</div>}
      {types.map((type) => (
        <div key={type} className="ds-card ds-card--row tone-soft sd-explainer-card" style={hueStyle(DIARY_HUE[type])}>
          <div>{explainers[type].what}</div>
          <div className="ds-sub sd-explainer-why">{explainers[type].why}</div>
        </div>
      ))}
      <div className="sd-explainer-foot">
        {filter === 'tracker' ? 'Первая отметка — плитка «Трекер» на главной.' : 'Первая запись — кнопка «Записать» выше, пара минут.'}
      </div>
    </div>
  );
}
