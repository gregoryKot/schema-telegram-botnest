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
        label="Критик или забота?"
        sub="Проверить фразу внутреннего голоса"
        index={0}
        onClick={onOpenPhraseCheck}
      />
      <ToolRow
        label="Мои цели"
        sub={
          tasksCount === 0
            ? 'Нет активных'
            : `${tasksCount} ${plural(tasksCount, 'цель', 'цели', 'целей')}`
        }
        index={1}
        onClick={onOpenTasks}
      />
      <ToolRow
        label="Практики"
        sub={
          practiceCount == null
            ? undefined
            : practiceCount === 0
              ? 'Нет практик'
              : `${practiceCount} ${plural(practiceCount, 'практика', 'практики', 'практик')}`
        }
        index={2}
        onClick={onOpenPractices}
      />
      <ToolRow
        label="Планы"
        sub={
          planCount == null
            ? undefined
            : planCount === 0
              ? 'История пуста'
              : `${planCount} ${plural(planCount, 'план', 'плана', 'планов')}`
        }
        index={3}
        onClick={onOpenPlans}
      />
      <ToolRow
        label="Проверка убеждений"
        sub="Правда ли это?"
        index={4}
        onClick={onOpenBeliefCheck}
      />
      <ToolRow
        label="Безопасное место"
        sub="Ресурс в тревожный момент"
        index={5}
        onClick={onOpenSafePlace}
      />
      <ToolRow
        label="Письмо себе"
        sub="Уязвимому Ребёнку"
        index={6}
        onClick={onOpenLetterToSelf}
      />
      <ToolRow
        label="Схема включилась"
        sub="5 шагов чтобы разобраться"
        index={7}
        onClick={onOpenFlashcard}
      />
      <ToolRow
        label="Колесо детства"
        sub={childhoodDone ? 'Паттерны из прошлого' : 'Займёт 2 минуты'}
        index={8}
        onClick={onOpenChildhoodWheel}
      />
      <ToolRow
        label="Тёплые слова"
        sub="Слова поддержки себе"
        index={9}
        onClick={onOpenWarmWords}
      />
    </>
  );
}
