import { ScenePebbleLaid } from '../art/AppScenes';
import { EntitySheet } from '../paper/EntitySheet';
import { ExplainerPaperCard } from './ExplainerPaperCard';
import { useTr } from '../../utils/addressForm';
import { ENTITY_LOOK, type EntityId } from '../../../../shared/src/theme/entityLook';
import { buildDiaryExplainers, DIARY_HUB_INTRO } from '../../../../shared/src/diary/diaryExplainers';
import type { DiaryFilter } from '../../sections/diary/diaryModel';
import '../../styles/client-diary-empty.css';
import { glue } from '../../../../shared/src/utils/typo';

// Пустая лента «Записей» (b11): новичку — сцена «первая страница» на бумаге страницы (ScenePebbleLaid filled=0:
// чистый лист, камешки ждут рядом гнёздами; «Записано» кладёт первый на лист — «ничего нет» и «получилось» не
// одна картинка, ревью g3) и ответ «что это и зачем», пустой «Дневник» — та же
// сцена; пустые «Трекер» и «Случаи» — лист своей сущности со знаком (Strokes, Ribbon). «Схема» и «Режим» — плитки.
const TITLE: Record<DiaryFilter, string> = { all: 'Пока ни одной записи', diary: 'Записей дневника пока нет', case: 'Разборов пока нет', tracker: 'Отметок трекера пока нет' };
const CASE_INTRO = 'Разбор — три коротких вопроса про момент, когда что-то зацепило. Через 2–3 разбора видно, что повторяется.';
const TRACKER_INTRO = 'Трекер — пять коротких вопросов про базовые потребности, минута в день. Через 3–5 дней видно, что питает, а чего не хватает.';
const INTRO: Record<Exclude<DiaryFilter, 'diary'>, string> = { all: DIARY_HUB_INTRO, tracker: TRACKER_INTRO, case: CASE_INTRO };
const FOOT: Record<DiaryFilter, string> = {
  all: 'Первая запись — кнопка «Записать» выше, пара минут.',
  diary: 'Первая запись — кнопка «Записать» выше, пара минут.',
  tracker: 'Первая отметка — плитка «Трекер» на главной.',
  case: 'Первый разбор — плитка «Что случилось» на главной.',
};
const LOOK: Record<'case' | 'tracker', EntityId> = { case: 'case', tracker: 'tracker' };

export function DiaryEmptyExplainer({ filter }: { filter: DiaryFilter }) {
  const explainers = buildDiaryExplainers(useTr());
  return (
    <div className="cd-empty-stack">
      {filter === 'all' || filter === 'diary' ? (
        <div className="cd-empty">
          <div className="cd-empty-scene" aria-hidden="true"><ScenePebbleLaid hue={ENTITY_LOOK.diary.hue} filled={0} /></div>
          <div className="cd-empty-body"><h2 className="cd-empty-title">{TITLE[filter]}</h2>{filter === 'all' && <p className="cd-empty-sub">{glue(INTRO.all)}</p>}<p className="cd-empty-foot">{glue(FOOT[filter])}</p></div>
        </div>
      ) : <EntitySheet look={LOOK[filter]} title={TITLE[filter]} sub={glue(INTRO[filter])} meta={glue(FOOT[filter])} />}
      {(filter === 'all' || filter === 'diary') && <div className="cd-explainers">
        {(['schema', 'mode'] as const).map((type) => <ExplainerPaperCard key={type} type={type} what={explainers[type].what} why={explainers[type].why} />)}
      </div>}
    </div>
  );
}
