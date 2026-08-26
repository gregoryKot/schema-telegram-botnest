import { ToolRow } from '../../components/ToolRow';
import { BreathingCard } from '../../components/BreathingCard';
import { practiceCountLabel } from '../../components/PracticeDoneFooter';
import type { QuickPracticeId } from '../../../../shared/src/practices/quickPractices';
import type { HelpOverlaysState } from './useHelpOverlays';

// Блок «Здесь и сейчас» раздела «Помощь»: быстрые практики первым экраном.
// Вынесено из HelpSection.tsx (правило №10).
export function HereAndNow({
  overlays,
  practiceCounts,
}: {
  overlays: HelpOverlaysState;
  practiceCounts: Record<QuickPracticeId, number> | null;
}) {
  return (
    <>
      {/* ── «Здесь и сейчас» (дизайн-макет, волна 2): дыхание первым ── */}
      <BreathingCard />

      <div className="section-label" style={{ margin: '8px 4px -4px' }}>
        Если нужно больше
      </div>
      <ToolRow
        label="Заземление 5-4-3-2-1"
        sub={
          practiceCountLabel(practiceCounts?.grounding ?? null) ??
          'вернуться в тело и в комнату'
        }
        index={0}
        onClick={() => overlays.show('grounding')}
      />
      <ToolRow
        label="Техника «Стоп»"
        sub={
          practiceCountLabel(practiceCounts?.stop ?? null) ??
          'пауза между импульсом и действием'
        }
        index={1}
        onClick={() => overlays.show('stop')}
      />
      <ToolRow
        label="Мне очень плохо"
        sub="контакты помощи прямо сейчас"
        danger
        index={2}
        onClick={() => overlays.show('crisis')}
      />
    </>
  );
}
