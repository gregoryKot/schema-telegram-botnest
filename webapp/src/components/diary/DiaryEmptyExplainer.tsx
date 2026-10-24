import type { DiaryType } from '../../types';
import { DIARY_HUE, hueStyle } from '../../lib/tone';
import '../../styles/sheet-diary.css';
import { useTr } from '../../utils/addressForm';
import {
  buildDiaryExplainers,
  DIARY_HUB_INTRO,
} from '../../../../shared/src/diary/diaryExplainers';

// Пустой архив — первая встреча новичка с дневниками, поэтому вместо
// «Пусто.» здесь ответ «что это и зачем» (правило онбординга CLAUDE.md).
// Контент — общий buildDiaryExplainers, тот же, что в мини-аппе (правило №3).
export function DiaryEmptyExplainer({ filter }: { filter: 'all' | DiaryType }) {
  const tr = useTr();
  const explainers = buildDiaryExplainers(tr);
  const types: DiaryType[] = filter === 'all' ? ['schema', 'mode'] : [filter];

  return (
    <div className="sd-explainer-wrap">
      <div className="ds-h2 sd-explainer-title">
        {filter === 'all' ? 'Пока ни одной записи' : 'Нет записей этого типа'}
      </div>
      {filter === 'all' && <div className="sd-explainer-intro">{DIARY_HUB_INTRO}</div>}
      {types.map((type) => {
        const ex = explainers[type];
        return (
          <div key={type} className="ds-card ds-card--row tone-soft sd-explainer-card" style={hueStyle(DIARY_HUE[type])}>
            <div>{ex.what}</div>
            <div className="ds-sub sd-explainer-why">{ex.why}</div>
          </div>
        );
      })}
      <div className="sd-explainer-foot">
        Первая запись — карточка «+ записать» выше, пара минут.
      </div>
    </div>
  );
}
