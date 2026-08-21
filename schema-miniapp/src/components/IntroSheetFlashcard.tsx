import { CrisisGate } from './CrisisGate';
import { DiaryTextArea } from './diary/DiaryTextArea';

export interface IntroSheetQuestion<T extends Record<string, string>> {
  key: keyof T;
  label: string;
  hint: string;
  placeholder: string;
  optional?: boolean;
}

interface Props<T extends Record<string, string>> {
  step: number;
  totalSteps: number;
  question: IntroSheetQuestion<T>;
  answer: string;
  onChange: (value: string) => void;
}

// Шаг карточки схемы/режима: вопрос — подсказка — поле ответа, всё сразу на
// экране. Раньше здесь была «флэшкарта с переворотом»: поле пряталось за
// тапом по карточке, и это ломало сразу две вещи —
//   1) непонятно, куда жать (правило онбординга: одно очевидное действие);
//   2) карточка-обёртка была pressable, и пробел из textarea уходил ей в
//      preventDefault() — текст набирался без пробелов (фикс в shared a11y).
// Разметка шага теперь та же, что в дневнике (ModeDiaryWizard): одинаковый
// ввод выглядит одинаково — и в вебаппе (FlashcardEx) он всегда был такой.
export function IntroSheetFlashcard<T extends Record<string, string>>({
  step,
  totalSteps,
  question,
  answer,
  onChange,
}: Props<T>) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 12 }}
      >
        Шаг {step + 1} из {totalSteps}
        {question.optional && ' · можно пропустить'}
      </div>

      <div
        id="intro-flashcard-question"
        style={{
          fontSize: 17,
          fontWeight: 700,
          color: 'var(--text)',
          lineHeight: 1.3,
          marginBottom: 4,
        }}
      >
        {question.label}
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--text-sub)',
          lineHeight: 1.5,
          marginBottom: 12,
        }}
      >
        {question.hint}
      </div>

      <DiaryTextArea
        value={answer}
        onChange={onChange}
        placeholder={question.placeholder}
        rows={4}
        labelId="intro-flashcard-question"
      />

      <CrisisGate texts={[answer]} surface="flashcard" />
    </div>
  );
}
