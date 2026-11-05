import { Cup } from '../art/PaperArt';
import { ExplainerPaperCard } from './ExplainerPaperCard';
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
    <div className="sd-explainer-stack">
      <div className="pp-empty"><Cup /><p className="ds-list-title">{TITLE[filter]}</p></div>
      {filter !== 'diary' && <p className="ds-empty">{INTRO[filter]}</p>}
      {types.map((type) => <ExplainerPaperCard key={type} type={type} what={explainers[type].what} why={explainers[type].why} />)}
      <p className="ds-empty">{FOOT[filter]}</p>
    </div>
  );
}
