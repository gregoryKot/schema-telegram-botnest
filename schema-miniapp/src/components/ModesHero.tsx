// Hero вкладки «Режимы» (волна 2 нейродизайна, правило «онбординг и
// очевидность»). Новичку — одно очевидное знакомство: Требовательный Критик,
// самый узнаваемый режим. Опытному — сводка недели «Чаще всего включается»
// из дневника режимов.
import { ALL_MODES, MODE_GROUPS } from '../schemaTherapyData';
import { useTr } from '../utils/addressForm';
import { ToolRow } from './ToolRow';
import { HeroCta } from './HeroCta';
import { WeekTopCard } from './WeekTopCard';
import { WeekTopSummary } from '../utils/patternsSummary';

export const INTRO_MODE_ID = 'demanding_critic';

interface Props {
  hasModes: boolean;
  summary: WeekTopSummary | null;
  onMeetCritic: () => void;
  onOpenLibrary: () => void;
  onPickManually: () => void;
  onOpenModeDetail: (id: string) => void;
  onOpenDiaries?: () => void;
}

export function ModesHero({
  hasModes,
  summary,
  onMeetCritic,
  onOpenLibrary,
  onPickManually,
  onOpenModeDetail,
  onOpenDiaries,
}: Props) {
  const tr = useTr();

  if (!hasModes) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <HeroCta
          label="Знакомство"
          chip="⏱ ≈2 мин"
          title="Встретить своего Критика"
          sub={tr(
            'Режимы — состояния, которые включаются в моменте. Начни с самого узнаваемого: внутреннего голоса требований.',
            'Режимы — состояния, которые включаются в моменте. Начните с самого узнаваемого: внутреннего голоса требований.',
          )}
          buttonLabel="😬 Познакомиться"
          onClick={onMeetCritic}
        />
        <ToolRow
          emoji="🔄"
          label="Что такое режимы"
          sub="части, которые включаются по очереди"
          tint="var(--accent-blue)"
          index={1}
          onClick={onOpenLibrary}
        />
        <ToolRow
          emoji="✍️"
          label="Отметить свои"
          sub={tr('если уже знаешь свои режимы', 'если уже знаете свои режимы')}
          tint="var(--accent-green)"
          index={2}
          onClick={onPickManually}
        />
      </div>
    );
  }

  if (summary) {
    const mode = ALL_MODES.find((m) => m.id === summary.id);
    const group = MODE_GROUPS.find((g) =>
      g.items.some((m) => m.id === summary.id),
    );
    if (!mode || !group) return null;
    return (
      <WeekTopCard
        label="Чаще всего включается"
        color={group.color}
        title={`${mode.emoji} ${mode.name}`}
        sub={`${summary.days} из ${summary.windowDays} дней — по записям дневника. Заметить включение — уже полработы.`}
        onClick={() => onOpenModeDetail(summary.id)}
      />
    );
  }

  if (onOpenDiaries) {
    return (
      <ToolRow
        emoji="📔"
        label="Картина недели появится из дневника"
        sub={tr(
          'замечай моменты, когда режим включился',
          'замечайте моменты, когда режим включился',
        )}
        tint="var(--accent-indigo)"
        onClick={onOpenDiaries}
      />
    );
  }
  return null;
}
