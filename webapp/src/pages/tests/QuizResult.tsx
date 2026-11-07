import { Link } from 'react-router-dom';
import type { QuizDto, QuizResultDto } from '../../../../shared/src/quiz/quizEngine';
import { SceneNotice } from '../../components/art/LandingScenes';
import { AUTHOR_SITE, trackPracticeClick } from '../landing/practiceLink';

interface Props {
  quiz: QuizDto;
  result: QuizResultDto;
  copied: boolean;
  onShare: () => void;
  onRestart: () => void;
}

// Результат мини-теста: наблюдение на бумаге шалфея со сценой «замечать и менять»
// (SceneNotice: полоска выпрямилась, растёт лист), под ним бумага соломы «Что с этим
// делать», действия и мягкий мост к практике (practice_link_click, place: quiz).
export function QuizResult({ quiz, result, copied, onShare, onRestart }: Props) {
  return (
    <div>
      <span className="pl2-eyebrow pl2-result-eyebrow">{quiz.title} · результат</span>
      <div className="pp-paper pl2-result">
        <div className="pl2-result-art"><SceneNotice /></div>
        <div className="pl2-card">
          <h1 className="pl2-h1 pl2-result-title">{result.title}</h1>
          <p className="pl2-card-text">{result.text}</p>
        </div>
      </div>
      <div className="pp-paper pl2-card pl2-card--paper pl2-hint">
        <span className="pl2-eyebrow">Что с этим делать</span>
        <p className="pl2-card-text">{result.hint}</p>
      </div>
      <div className="pl2-actions pl2-result-actions">
        <button onClick={onShare} className="ds-btn">
          {copied ? 'Скопировано ✓' : 'Поделиться результатом'}
        </button>
        <button onClick={onRestart} className="ds-btn ds-btn--secondary">
          Пройти ещё раз
        </button>
        <Link to="/tests" className="ds-btn ds-btn--secondary pl2-cta">
          Другие тесты
        </Link>
      </div>
      <p className="pl2-fine pl2-result-fine">
        Это игра-наблюдение, а не диагноз. Если тема отозвалась — в
        приложении есть большой тест схем (116 вопросов) и трекер
        потребностей.
      </p>
      <div className="ds-card ds-card--row pl2-card pl2-result-bridge">
        <p className="pl2-card-text">
          Хочется разобрать результат с живым специалистом? Автор проекта
          работает в подходе схема-терапия, онлайн. Первая встреча — 15 минут,
          бесплатно.{' '}
          <a href={AUTHOR_SITE} target="_blank" rel="noopener noreferrer" onClick={() => trackPracticeClick('quiz')} className="pl2-link pl2-nowrap">
            Познакомиться ↗
          </a>
        </p>
      </div>
    </div>
  );
}
