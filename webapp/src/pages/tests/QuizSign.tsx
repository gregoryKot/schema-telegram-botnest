import type { CSSProperties } from 'react';
import type { QuizDto } from '../../api';
import { quizLook } from './quizLook';

/** Знак мини-теста на квадрате цветной бумаги (строка списка). Декор: имя несёт текст рядом. */
export function QuizSign({ quiz, index }: { quiz: Pick<QuizDto, 'id' | 'emoji'>; index: number }) {
  const { Art, hue } = quizLook(quiz.id, index);
  return (
    <span aria-hidden="true" className="pl2-quiz-sign" style={{ '--h': hue } as CSSProperties}>
      {Art ? <Art size="square" /> : quiz.emoji}
    </span>
  );
}
