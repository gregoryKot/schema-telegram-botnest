import type { CSSProperties } from 'react';
import type { QuizDto } from '../../api';
import { SignScene } from '../../components/art/SceneParts';
import { quizLook } from './quizLook';

/** Знак мини-теста на бумажном бейдже (строка списка): знак кабинета крупно с тенью-вырезкой,
 *  у теста без знака — его эмодзи. Декор: имя несёт текст рядом. */
export function QuizSign({ quiz, index }: { quiz: Pick<QuizDto, 'id' | 'emoji'>; index: number }) {
  const { Art, hue } = quizLook(quiz.id, index);
  return (
    <span aria-hidden="true" className="pl2-quiz-sign" style={{ '--h': hue } as CSSProperties}>
      {Art ? <SignScene Art={Art} /> : quiz.emoji}
    </span>
  );
}
