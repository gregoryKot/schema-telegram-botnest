import { haptic } from '../../haptic';
import { api } from '../../api';
import { useTr } from '../../utils/addressForm';
import { getModeById } from '../../schemaTherapyData';
import { DiaryPanel, DiaryRow } from './diaryUi';
import { SummaryBlock } from './diaryFlowUi';
import { MODE_PICKER_GROUPS } from '../../../../shared/src/mode/modeBodyCues';
import { MODE_TEST_COMPLETED_EVENT } from '../../../../shared/src/share/analytics';

/** Первое предложение описания — одна строка под названием, без простыни. */
function firstSentence(text: string): string {
  const end = text.indexOf('. ');
  return end === -1 ? text : text.slice(0, end + 1);
}

/**
 * Шаг 2 дневника режимов: из выбранной семьи — 1–5 кандидатов. Заголовок
 * строки — фраза-переживание, а не термин (термин уходит в мету): человек
 * узнаёт своё состояние по тому, как оно ощущается изнутри.
 *
 * Мягкий выход обязателен: не выбрать — нормальный исход, а не тупик. Из
 * любой семьи он ведёт во вход «подскажет тело» (семья unknown), из него
 * самого — назад к списку состояний.
 */
export function ModeCandidateStep({
  groupId,
  onPickMode,
  onPickGroup,
  onBack,
}: {
  groupId: string;
  onPickMode: (modeId: string) => void;
  onPickGroup: (groupId: string) => void;
  onBack: () => void;
}) {
  const tr = useTr();
  const group = MODE_PICKER_GROUPS.find((g) => g.id === groupId);
  if (!group) return null;

  const isUnknown = group.id === 'unknown';

  return (
    <div>
      <SummaryBlock
        label={tr('Твоё состояние', 'Ваше состояние')}
        text={group.title}
        onEdit={onBack}
      />

      <div className="d-display" style={{ fontSize: 21, marginBottom: 8 }}>
        Кто из режимов сейчас ближе всего?
      </div>
      <div
        style={{
          fontSize: 14,
          color: 'var(--muted)',
          lineHeight: 1.5,
          marginBottom: 20,
        }}
      >
        {group.hint}
      </div>

      <DiaryPanel>
        {group.leaves.map((leaf) => (
          <DiaryRow
            key={leaf.modeId + leaf.label}
            title={leaf.label}
            desc={firstSentence(leaf.desc)}
            meta={getModeById(leaf.modeId)?.name}
            trailing="dot"
            onClick={() => {
              api.trackEvent(MODE_TEST_COMPLETED_EVENT, {
                modeId: leaf.modeId,
              });
              onPickMode(leaf.modeId);
            }}
          />
        ))}
      </DiaryPanel>

      <button
        onClick={() => {
          haptic.tap();
          if (isUnknown) onBack();
          else onPickGroup('unknown');
        }}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--accent)',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          padding: '18px 2px',
          minHeight: 48,
          textAlign: 'left',
        }}
      >
        {isUnknown
          ? 'Не могу выбрать — вернуться к состояниям'
          : 'Не могу выбрать — пусть подскажет тело'}
      </button>
    </div>
  );
}
