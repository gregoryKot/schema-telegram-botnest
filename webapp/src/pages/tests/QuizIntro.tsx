import { Link } from 'react-router-dom';
import type { QuizDto } from '../../api';
import { SceneQuiz } from '../../components/art/LandingScenesMore';

// Вступление мини-теста: «что это и зачем» до первого вопроса (правило онбординга) и
// одна залитая кнопка. Рядом сцена колоды вопросов (SceneQuiz) на пятне бумаги.
export function QuizIntro({ quiz, onStart }: { quiz: QuizDto; onStart: () => void }) {
  return (
    <div>
      <Link to="/tests" className="pl2-link pl2-link--solo pl2-back">← Все тесты</Link>
      <div className="pl2-quiz-intro">
        <div className="pl2-quiz-intro-art"><SceneQuiz /></div>
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
