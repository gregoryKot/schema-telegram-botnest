import type { DiaryType } from '../../types';
import { useTr } from '../../utils/addressForm';
import {
  buildDiaryExplainers,
  DIARY_HUB_INTRO,
} from '../../../../shared/src/diary/diaryExplainers';

const TYPE_COLORS: Record<DiaryType, string> = {
  schema: 'var(--c-rose)',
  mode: 'var(--c-slate)',
  gratitude: 'var(--c-moss)',
};

// Пустой архив — первая встреча новичка с дневниками, поэтому вместо
// «Пусто.» здесь ответ «что это и зачем» (правило онбординга CLAUDE.md).
// Контент — общий buildDiaryExplainers, тот же, что в мини-аппе (правило №3).
export function DiaryEmptyExplainer({ filter }: { filter: 'all' | DiaryType }) {
  const tr = useTr();
  const explainers = buildDiaryExplainers(tr);
  const types: DiaryType[] = filter === 'all' ? ['schema', 'mode'] : [filter];

  return (
    <div style={{ padding: '40px 0 60px', maxWidth: 640, margin: '0 auto' }}>
      <div
        style={{
          fontFamily: 'var(--serif)',
          fontSize: 24,
          color: 'var(--text-sub)',
          fontStyle: 'italic',
          textAlign: 'center',
          marginBottom: 10,
        }}
      >
        {filter === 'all' ? 'Пока ни одной записи' : 'Нет записей этого типа'}
      </div>
      {filter === 'all' && (
        <div
          style={{
            fontSize: 14,
            color: 'var(--text-sub)',
            lineHeight: 1.65,
            textAlign: 'center',
            marginBottom: 24,
          }}
        >
          {DIARY_HUB_INTRO}
        </div>
      )}
      {types.map((type) => {
        const ex = explainers[type];
        return (
          <div
            key={type}
            style={{
              display: 'flex',
              gap: 14,
              alignItems: 'flex-start',
              padding: '16px 18px',
              borderRadius: 14,
              border: '1px solid var(--line)',
              marginBottom: 12,
              background: `color-mix(in srgb, ${TYPE_COLORS[type]} 4%, transparent)`,
            }}
          >
            <div style={{ fontSize: 13.5, lineHeight: 1.65 }}>
              <div style={{ color: 'var(--text)' }}>{ex.what}</div>
              <div style={{ color: 'var(--text-sub)', marginTop: 8 }}>
                {ex.why}
              </div>
            </div>
          </div>
        );
      })}
      <div
        style={{
          fontSize: 13,
          color: 'var(--text-faint)',
          textAlign: 'center',
          marginTop: 18,
        }}
      >
        Первая запись — карточка «+ записать» выше, пара минут.
      </div>
    </div>
  );
}
