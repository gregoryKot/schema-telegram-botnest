import { useState } from 'react';
import { haptic } from '../../haptic';
import { useTr } from '../../utils/addressForm';
import { CapsLabel, DiaryPanel, DiaryRow } from './diaryUi';
import { ModeGroupList } from './ModeGroupList';
import { MODE_PICKER_GROUPS } from '../../../../shared/src/mode/modeFeelGates';
import { buildModeDiaryExplainer } from '../../../../shared/src/mode/modeFlowExplainers';

/**
 * Шаг 1 дневника режимов: чувство обычными словами. Ворота по базовым
 * чувствам (FEEL_GATES) строками в одном контейнере — человеку не нужно знать
 * ни одного термина, чтобы начать. Точное название режима — третичный путь
 * за раскрытием «Все режимы по группам», для тех, кто термины уже знает.
 */
export function ModeStateStep({
  onPickGroup,
  onPickMode,
  showDiaryExplainer = true,
}: {
  onPickGroup: (groupId: string) => void;
  onPickMode: (modeId: string) => void;
  /**
   * Абзац «Дневник — про вчерашний вечер…» написан для дневника режимов —
   * он противопоставляет дневник карточке. В разборе случая (CaseFlowSheet)
   * тот же шаг работает про ТЕКУЩИЙ момент, и абзац там сбивает («при чём
   * тут вчерашний вечер?») да ещё и произносит слово «режим» до экрана,
   * который его вводит. Фидбек владельца 2026-08-31.
   */
  showDiaryExplainer?: boolean;
}) {
  const tr = useTr();
  const [showList, setShowList] = useState(false);

  return (
    <div>
      <div className="d-display" style={{ fontSize: 21, marginBottom: 8 }}>
        {tr('Что ты сейчас чувствуешь?', 'Что вы сейчас чувствуете?')}
      </div>
      <div
        style={{
          fontSize: 14,
          color: 'var(--muted)',
          lineHeight: 1.5,
          marginBottom: 20,
        }}
      >
        {tr(
          'Выбери самое близкое — дальше уточним вместе. Ошибиться здесь невозможно.',
          'Выберите самое близкое — дальше уточним вместе. Ошибиться здесь невозможно.',
        )}
      </div>

      {showDiaryExplainer && (
        <div
          style={{
            fontSize: 13,
            color: 'var(--faint)',
            lineHeight: 1.5,
            marginBottom: 18,
          }}
        >
          {buildModeDiaryExplainer(tr)}
        </div>
      )}

      <DiaryPanel>
        {MODE_PICKER_GROUPS.map((g) => (
          <DiaryRow
            key={g.id}
            title={g.title}
            onClick={() => onPickGroup(g.id)}
          />
        ))}
      </DiaryPanel>

      <button
        onClick={() => {
          haptic.tap();
          setShowList((v) => !v);
        }}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--accent)',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          padding: '18px 2px 10px',
          minHeight: 48,
        }}
      >
        Все режимы по группам {showList ? '▲' : '▼'}
      </button>

      {showList && (
        <div style={{ marginTop: 4 }}>
          <CapsLabel>Точное название режима</CapsLabel>
          <ModeGroupList onChange={onPickMode} />
        </div>
      )}
    </div>
  );
}
