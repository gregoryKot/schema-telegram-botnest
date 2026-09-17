import { useTr } from '../../utils/addressForm';
import { DIARY_HUB_INTRO } from '../../../../shared/src/diary/diaryExplainers';

// Зачин хаба «Мои дневники». Пока нет ни одной записи, вместо короткой
// подводки — ответ «что это и зачем» для новичка (правило онбординга
// CLAUDE.md): без него названия «Дневник схем/режимов» ничего не говорят
// человеку, который со схема-терапией не знаком.
export function DiaryHubIntro({ empty }: { empty: boolean }) {
  const tr = useTr();

  // Пока записей нет — объяснение «что это и зачем» прямо на пути, а не в
  // спрятанном разделе. Как только дневник начат, подводка уходит: её работу
  // дальше делают подзаголовок хаба и мета-строки записей.
  if (!empty) return null;

  return (
    <div
      style={{
        background: 'var(--surface-2)',
        borderRadius: 18,
        padding: '16px 18px',
        marginBottom: 26,
      }}
    >
      <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55 }}>
        {DIARY_HUB_INTRO}
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--muted)',
          lineHeight: 1.5,
          marginTop: 10,
        }}
      >
        {tr(
          'Не знаешь, с чего начать, — открой любой: внутри всё объяснено.',
          'Не знаете, с чего начать, — откройте любой: внутри всё объяснено.',
        )}
      </div>
    </div>
  );
}
