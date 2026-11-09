// Публичный список мини-тестов (/tests) — без регистрации. Правило онбординга:
// страница сама отвечает «что это, зачем и сколько займёт» до первого действия.
// Справа от вступления — веер карточек-вопросов (SceneQuiz); строка — плитка цветной бумаги,
// оттенок по очереди (quizLook, его же берёт вступление теста), знак на бейдже (QuizSign); лид — glue.
import { useEffect, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useQuizzes } from '../../hooks/useQuizzes';
import { SkeletonCard } from '../../components/Skeleton';
import { SceneQuiz } from '../../components/art/LandingScenesMore';
import { TestsFrame } from './testsKit';
import { QuizSign } from './QuizSign';
import { quizLook } from './quizLook';
import { glue } from '../../../../shared/src/utils/typo';

export function TestsPage() {
  const { quizzes, error } = useQuizzes();

  useEffect(() => {
    document.title = 'Мини-тесты — Всё по схеме';
  }, []);

  return (
    <TestsFrame>
      <div className="pl2-tests-hero">
        <div>
          <div className="pl2-pill"><span className="pl2-pill-dot" />Без регистрации · результат сразу</div>
          <h1 className="pl2-h1 pl2-tests-h1">Мини-<em>тесты</em></h1>
          <p className="pl2-lead pl2-tests-lead">
            {glue('Лёгкие тесты по мотивам схема-терапии: ')}<span className="pl2-nowrap">6–7 вопросов</span>
            {glue(', пара минут — и небольшое наблюдение о себе с подсказкой, что с ним делать. Почты, регистрации и «мы вам перезвоним» не будет.')}
          </p>
        </div>
        <div className="pl2-tests-art"><SceneQuiz hue={135} /></div>
      </div>

      {error && (
        <div className="ds-card pl2-card-text">
          Не получилось загрузить тесты. <a href="/tests" className="pl2-link">Попробовать ещё раз</a>
        </div>
      )}

      {!quizzes && !error && (
        <div className="pl2-quiz-list" aria-label="Тесты загружаются">
          {[0, 1, 2].map((k) => <div key={k} className="pl2-quiz-skel"><SkeletonCard radius={24} style={{ height: '100%' }} /></div>)}
        </div>
      )}

      {quizzes && (
        <div className="pl2-quiz-list">
          {quizzes.map((q, i) => (
            <Link key={q.id} to={`/tests/${q.id}`} className="pp-paper pl2-quiz-row" style={{ '--h': quizLook(q.id, i).hue } as CSSProperties}>
              <QuizSign quiz={q} index={i} />
              <span className="pl2-card pl2-quiz-row-body">
                <span className="pl2-card-title">{q.title}</span>
                <span className="pl2-card-text">{q.teaser}</span>
                <span className="pl2-card-meta pl2-meta-flat">{q.questions.length} вопросов · ~2 минуты</span>
              </span>
              <span aria-hidden className="pl2-quiz-arrow">→</span>
            </Link>
          ))}
        </div>
      )}
    </TestsFrame>
  );
}
