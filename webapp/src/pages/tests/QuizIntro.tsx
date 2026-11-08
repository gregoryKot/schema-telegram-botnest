import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { QuizDto } from '../../api';
import { SceneQuiz } from '../../components/art/LandingScenesMore';
import { SignScene } from '../../components/art/SceneParts';
import { quizSign } from './quizLook';

// Вступление мини-теста: «что это и зачем» до первого вопроса (правило онбординга) и
// одна залитая кнопка. Рядом веер карточек-вопросов (SceneQuiz) на вырезанном листе
// оттенка теста — того же, что у его плитки в списке (`hue` из quizLook): плитка →
// вступление → результат одного цвета. На верхней карточке — знак этого теста (тот же,
// что на бейдже плитки; у теста без знака — его эмодзи). По ссылке «Поделиться
// результатом» приходят сюда.
export function QuizIntro({ quiz, hue, onStart }: { quiz: QuizDto; hue: number; onStart: () => void }) {
  const Art = quizSign(quiz.id);
  return (
    <div>
      <Link to="/tests" className="pl2-link pl2-link--solo pl2-back">← Все тесты</Link>
      <div className="pl2-quiz-intro">
        <div className="pl2-quiz-intro-art" style={{ '--h': hue } as CSSProperties}>
          <SceneQuiz hue={hue} sign />
          <span className="pl2-quiz-card-sign" aria-hidden="true">{Art ? <SignScene Art={Art} /> : quiz.emoji}</span>
        </div>
        <div>
          <h1 className="pl2-h1 pl2-quiz-h1">{quiz.title}</h1>
          <p className="pl2-lead pl2-quiz-lead">{quiz.intro}</p>
          <div className="pl2-actions">
            <button onClick={onStart} className="ds-btn pl2-cta--lg">
              Начать →
            </button>
            <span className="pl2-card-meta pl2-meta-flat">{quiz.questions.length} вопросов · ~2 минуты</span>
          </div>
        </div>
      </div>
    </div>
  );
}
