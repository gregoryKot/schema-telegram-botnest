import { ToolRow } from '../../components/ToolRow';
import { plural } from '../today/helpers';

// Блок «Инструменты» экрана «Здесь и сейчас» — 8 строк-переходов в отдельные
// упражнения/списки. Вынесено из HelpSection.tsx (правило №10, храповик
// размера файла — долг обязан таять). Поведение, порядок строк, index
// (каскадная анимация) и тексты не менялись.
interface Props {
  tasksCount: number;
  practiceCount?: number | null;
  planCount?: number | null;
  childhoodDone: boolean;
  onOpenTasks: () => void;
  onOpenPractices: () => void;
  onOpenPlans: () => void;
  onOpenBeliefCheck: () => void;
  onOpenPhraseCheck: () => void;
  onOpenSafePlace: () => void;
  onOpenLetterToSelf: () => void;
  onOpenFlashcard: () => void;
  onOpenChildhoodWheel: () => void;
  onOpenWarmWords: () => void;
}

export function ToolsList({
  tasksCount,
  practiceCount,
  planCount,
  childhoodDone,
  onOpenTasks,
  onOpenPractices,
  onOpenPlans,
  onOpenBeliefCheck,
  onOpenPhraseCheck,
  onOpenSafePlace,
  onOpenLetterToSelf,
  onOpenFlashcard,
  onOpenChildhoodWheel,
  onOpenWarmWords,
}: Props) {
  return (
    <>
      <div className="section-label" style={{ margin: '8px 4px -4px' }}>
        Инструменты
      </div>
      <ToolRow
        emoji="🎯"
        label="Мои цели"
        sub={
          tasksCount === 0
            ? 'Нет активных'
            : `${tasksCount} ${plural(tasksCount, 'цель', 'цели', 'целей')}`
        }
        tint="var(--accent-orange)"
        index={0}
        onClick={onOpenTasks}
      />
      <ToolRow
        emoji="🗂"
        label="Практики"
        sub={
          practiceCount == null
            ? undefined
            : practiceCount === 0
              ? 'Нет практик'
              : `${practiceCount} ${plural(practiceCount, 'практика', 'практики', 'практик')}`
        }
        tint="var(--accent)"
        index={1}
        onClick={onOpenPractices}
      />
      <ToolRow
        emoji="🗓"
        label="Планы"
        sub={
          planCount == null
            ? undefined
            : planCount === 0
              ? 'История пуста'
              : `${planCount} ${plural(planCount, 'план', 'плана', 'планов')}`
        }
        tint="var(--accent-blue)"
        index={2}
        onClick={onOpenPlans}
      />
      <ToolRow
        emoji="🔍"
        label="Проверка убеждений"
        sub="Правда ли это?"
        tint="var(--accent-yellow)"
        index={3}
        onClick={onOpenBeliefCheck}
      />
      <ToolRow
        emoji="🔎"
        label="Критик или забота?"
        sub="Проверить фразу внутреннего голоса"
        tint="var(--accent-red)"
        index={4}
        onClick={onOpenPhraseCheck}
      />
      <ToolRow
        emoji="🏡"
        label="Безопасное место"
        sub="Ресурс в тревожный момент"
        tint="var(--accent-green)"
        index={5}
        onClick={onOpenSafePlace}
      />
      <ToolRow
        emoji="✉️"
        label="Письмо себе"
        sub="Уязвимому Ребёнку"
        tint="var(--accent-pink)"
        index={6}
        onClick={onOpenLetterToSelf}
      />
      <ToolRow
        emoji="🆘"
        label="Схема включилась"
        sub="5 шагов чтобы разобраться"
        tint="var(--accent-indigo)"
        index={7}
        onClick={onOpenFlashcard}
      />
      <ToolRow
        emoji="🌱"
        label="Колесо детства"
        sub={childhoodDone ? 'Паттерны из прошлого' : 'Займёт 2 минуты'}
        tint="var(--accent-green)"
        index={8}
        onClick={onOpenChildhoodWheel}
      />
      <ToolRow
        emoji="💛"
        label="Тёплые слова"
        sub="Слова поддержки себе"
        tint="var(--accent-yellow)"
        index={9}
        onClick={onOpenWarmWords}
      />
    </>
  );
}
