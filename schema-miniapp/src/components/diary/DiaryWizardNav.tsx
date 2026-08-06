import { haptic } from '../../haptic';
import { WizardNav } from '../WizardNav';

/**
 * Низ дневникового визарда: «← Назад» и главная кнопка, которая по шагу сама
 * решает, что она — «Далее», «Пропустить» или «Готово».
 *
 * Общая для дневника режимов и дневника схем: блок был у них слово в слово
 * одинаковым, различался лишь способ узнать, заполнен ли текущий шаг
 * (`filled`). Пока копий было две, правка навигации доезжала до одной.
 */
export function DiaryWizardNav({
  accentColor,
  step,
  onStep,
  isLast,
  filled,
  optional,
  canNext,
  canSave,
  saving,
  onSave,
}: {
  accentColor: string;
  step: number;
  onStep: (next: number) => void;
  /** последний шаг: главная кнопка сохраняет, а не ведёт дальше */
  isLast: boolean;
  /** в текущем шаге уже что-то есть */
  filled: boolean;
  /** шаг можно пропустить */
  optional: boolean;
  canNext: boolean;
  canSave: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <div style={{ marginTop: 16 }}>
      <WizardNav
        accentColor={accentColor}
        onBack={() => {
          haptic.tap();
          onStep(Math.max(0, step - 1));
        }}
        backDisabled={step === 0}
        primaryKind={isLast ? 'save' : 'next'}
        primaryLabel={
          isLast
            ? saving
              ? 'Сохраняю…'
              : 'Готово'
            : filled || !optional
              ? 'Далее →'
              : 'Пропустить'
        }
        onPrimary={
          isLast
            ? onSave
            : () => {
                haptic.tap();
                onStep(step + 1);
              }
        }
        primaryDisabled={isLast ? !canSave || saving : !canNext}
      />
    </div>
  );
}
