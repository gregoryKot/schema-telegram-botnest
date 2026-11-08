import { useReducedMotionPref } from '../../hooks/useReducedMotionPref';
import { SSection, SRow, Toggle } from './ui';

// Раздел «Оформление» — вынесен из SettingsSheet.tsx (правило №10). Тумблера
// темы здесь больше нет: кабинет только светлый (редизайн 2026-10), тема
// переключается только на лендинге. Режима «клиент/терапевт» и снятия роли
// специалиста здесь тоже нет: с #902 это первый блок листа (ModeSection).
// «Сохранено ✓» после переключения «Меньше движения» — общий тост в шапке
// родителя, поэтому единственное, что секция отдаёт наружу, — колбэк onSaved.
export function AppearanceSection({ onSaved }: { onSaved: () => void }) {
  const motion = useReducedMotionPref(onSaved);

  return (
    <SSection id="s-appearance" label="Оформление">
      {/* Нейроинклюзивность: сниженная анимация (WCAG 2.3.3) */}
      <SRow
        title="Меньше движения"
        sub={motion.sub}
        right={<Toggle on={motion.reduced} onClick={motion.toggle} label="Меньше движения" />}
      />
    </SSection>
  );
}
