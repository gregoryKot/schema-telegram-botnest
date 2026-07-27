import { useTr } from '../../utils/addressForm';
import { DIARY_HUB_INTRO } from '../../../../shared/src/diary/diaryExplainers';

// Зачин хаба «Мои дневники». Пока нет ни одной записи, вместо короткой
// подводки — ответ «что это и зачем» для новичка (правило онбординга
// CLAUDE.md): без него названия «Дневник схем/режимов» ничего не говорят
// человеку, который со схема-терапией не знаком.
export function DiaryHubIntro({ empty }: { empty: boolean }) {
  const tr = useTr();

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5 }}>
        {empty
          ? DIARY_HUB_INTRO
          : tr(
              'Замечай паттерны, фиксируй моменты. Веди один или все три — как тебе удобно.',
              'Замечайте паттерны, фиксируйте моменты. Ведите один или все три — как вам удобно.',
            )}
      </div>
      {empty && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-faint)',
            lineHeight: 1.5,
            marginTop: 8,
          }}
        >
          {tr(
            'Не знаешь, с чего начать, — открой любой: внутри всё объяснено.',
            'Не знаете, с чего начать, — откройте любой: внутри всё объяснено.',
          )}
        </div>
      )}
    </div>
  );
}
