import { useState } from 'react';
import { ExScreen } from '../exercises/ExScreen';
import { useTr } from '../../utils/addressForm';
import { MODE_PICKER_GROUPS } from '../../../../shared/src/mode/modeBodyCues';
import { MODE_TEST_COMPLETED_EVENT } from '../../../../shared/src/share/analytics';
import { haptic } from '../../haptic';
import { api } from '../../api';

interface Props {
  /** выбран лист теста → id режима для формы */
  onPick: (modeId: string) => void;
  /** выйти из теста обратно к выбору режима */
  onBack: () => void;
}

// Тест «какой режим включился» — определение по ФУНКЦИИ, а не по названию.
// Шаг 1: 8 крупных состояний + вход «не знаю, что чувствую» последним. Шаг 2:
// листы внутри семьи. Метки form-agnostic (1-е лицо / нейтральные) — не
// разводятся по ты/вы; разводятся только обращённые к пользователю ledes.
export function ModeTestScreen({ onPick, onBack }: Props) {
  const tr = useTr();
  const [groupId, setGroupId] = useState<string | null>(null);
  const group = groupId ? MODE_PICKER_GROUPS.find(g => g.id === groupId) ?? null : null;

  // ── Уровень 1: крупные состояния ──
  if (!group) {
    return (
      <ExScreen
        onBack={onBack}
        backLabel="Назад к выбору"
        eyebrow="Определим режим по чувству"
        eyebrowColor="var(--c-slate)"
        title={<>Что со мной<br /><span className="it">сейчас?</span></>}
        lede={tr(
          'Выбери, что ближе всего к состоянию прямо сейчас. Дальше уточним — до конкретного режима.',
          'Выберите, что ближе всего к состоянию прямо сейчас. Дальше уточним — до конкретного режима.',
        )}
        aside={
          <div className="aside-card" style={{ borderColor: 'var(--c-slate)40', background: 'var(--c-slate)08' }}>
            <div className="aside-card-eyebrow" style={{ color: 'var(--c-slate)' }}>Почему так</div>
            <h3>Режим — по функции</h3>
            <p className="body">Режим надёжнее узнаётся не по названию, а по тому, что он делает с болью: защищает, злится, критикует. Поэтому сначала — крупное «что со мной», потом уточнение.</p>
          </div>
        }
      >
        {MODE_PICKER_GROUPS.map(g => (
          <button
            key={g.id}
            type="button"
            className="mode-test-row"
            onClick={() => { haptic.select(); setGroupId(g.id); }}
          >
            <span className="mode-test-row-emoji">{g.emoji}</span>
            <span className="mode-test-row-text">
              <span className="mode-test-row-title">{g.title}</span>
              <span className="mode-test-row-hint">{g.hint}</span>
            </span>
          </button>
        ))}
      </ExScreen>
    );
  }

  // ── Уровень 2: листы внутри семьи ──
  return (
    <ExScreen
      onBack={() => setGroupId(null)}
      backLabel="К другим состояниям"
      eyebrow={<>{group.emoji} {group.title}</>}
      eyebrowColor="var(--c-slate)"
      title={<>Что ближе<br /><span className="it">всего?</span></>}
      lede={tr(
        'Выбери самое похожее — и продолжим запись. Точное название сейчас не так важно.',
        'Выберите самое похожее — и продолжим запись. Точное название сейчас не так важно.',
      )}
    >
      {group.leaves.map(l => (
        <button
          key={l.modeId}
          type="button"
          className="mode-test-row"
          onClick={() => {
            haptic.select();
            api.trackEvent(MODE_TEST_COMPLETED_EVENT, { modeId: l.modeId });
            onPick(l.modeId);
          }}
        >
          <span className="mode-test-row-emoji">{l.emoji}</span>
          <span className="mode-test-row-text">
            <span className="mode-test-row-title">{l.label}</span>
            <span className="mode-test-row-hint">{l.desc}</span>
          </span>
        </button>
      ))}
    </ExScreen>
  );
}
