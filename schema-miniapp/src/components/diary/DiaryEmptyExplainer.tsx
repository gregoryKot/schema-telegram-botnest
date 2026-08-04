import { DiaryType } from '../../types';
import { useTr } from '../../utils/addressForm';
import { buildDiaryExplainers } from '../../../../shared/src/diary/diaryExplainers';

// Пустой дневник — первая встреча новичка с фичей, поэтому вместо «пока
// тихо» здесь ответ на «что это и зачем» (правило онбординга CLAUDE.md).
// Контент — общий buildDiaryExplainers, одно очевидное действие — FAB внизу.
export function DiaryEmptyExplainer({ type }: { type: DiaryType }) {
  const tr = useTr();
  const ex = buildDiaryExplainers(tr)[type];

  return (
    <div style={{ padding: '24px 2px 60px' }}>
      <div
        style={{
          background: 'var(--surface-2)',
          borderRadius: 18,
          padding: '18px 20px',
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.65 }}>
          {ex.what}
        </div>
        <div
          style={{
            fontSize: 14,
            color: 'var(--muted)',
            lineHeight: 1.65,
            marginTop: 12,
          }}
        >
          {ex.why}
        </div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--faint)', paddingLeft: 2 }}>
        Первая запись — кнопка внизу, пара минут.
      </div>
    </div>
  );
}
