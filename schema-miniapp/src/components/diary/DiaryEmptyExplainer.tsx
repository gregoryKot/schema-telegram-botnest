import { DiaryType } from '../../types';
import { useTr } from '../../utils/addressForm';
import { buildDiaryExplainers } from '../../../../shared/src/diary/diaryExplainers';

// Пустой дневник — первая встреча новичка с фичей, поэтому вместо «пока
// тихо» здесь ответ на «что это и зачем» (правило онбординга CLAUDE.md).
// Контент — общий buildDiaryExplainers, одно очевидное действие — FAB внизу.
export function DiaryEmptyExplainer({
  type,
  color,
}: {
  type: DiaryType;
  color: string;
}) {
  const tr = useTr();
  const ex = buildDiaryExplainers(tr)[type];

  return (
    <div style={{ padding: '32px 4px 60px', textAlign: 'center' }}>
      <div style={{ fontSize: 42, marginBottom: 16, opacity: 0.5 }}>
        {ex.emoji}
      </div>
      <div
        className="card"
        style={{
          borderRadius: 16,
          padding: '16px 18px',
          marginBottom: 12,
          textAlign: 'left',
        }}
      >
        <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7 }}>
          {ex.what}
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-sub)',
            lineHeight: 1.7,
            marginTop: 10,
          }}
        >
          {ex.why}
        </div>
      </div>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 14px',
          borderRadius: 12,
          background: `color-mix(in srgb, ${color} 10%, transparent)`,
          fontSize: 13,
          color: 'var(--text-sub)',
        }}
      >
        <span>↓</span>
        Первая запись — кнопка внизу, пара минут.
      </div>
    </div>
  );
}
