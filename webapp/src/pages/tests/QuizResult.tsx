import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { QuizDto, QuizResultDto } from '../../../../shared/src/quiz/quizEngine';
import { SceneNotice } from '../../components/art/LandingScenes';
import { AUTHOR_SITE, trackPracticeClick } from '../landing/practiceLink';
import { resultHues } from './quizLook';
import { glue } from '../landing/typo';
import { QuizAppCta } from './QuizAppCta';

interface Props {
  quiz: QuizDto;
  /** Оттенок теста (quizLook): панель результата того же цвета, что плитка и вступление. */
  hue: number;
  result: QuizResultDto;
  copied: boolean;
  onShare: () => void;
  onRestart: () => void;
}

// Результат мини-теста: у результата своё лицо — его эмодзи на бумажном бейдже рядом с
// заголовком (на телефоне — наклейкой на углу сцены, чтобы заголовок попал в первый
// экран), — и сцена «замечать и менять» (SceneNotice: полоска выпрямилась, растёт лист)
// на панели оттенка теста. Лист сцены — соседний оттенок, квадратик — оттенок панели;
// под панелью бумага «Что с этим делать» другого тона (resultHues), действия и мягкий
// мост к практике (practice_link_click, place: quiz). Карточки плоские (.pp-paper).
// Неразрывные пробелы и дефис — glue (typo.ts): «(116 вопросов)» не рвётся после «(116».
export function QuizResult({ quiz, hue, result, copied, onShare, onRestart }: Props) {
  const { sceneHue, hintHue } = resultHues(hue);
  return (
    <div>
      <span className="pl2-eyebrow pl2-result-eyebrow">{quiz.title} · результат</span>
      <div className="pp-paper pl2-result" style={{ '--h': hue } as CSSProperties}>
        <div className="pl2-result-art"><SceneNotice hue={sceneHue} patch={hue} /></div>
        <div className="pl2-card">
          <span className="pl2-result-badge" aria-hidden="true">{result.emoji}</span>
          <h1 className="pl2-h1 pl2-result-title">{result.title}</h1>
          <p className="pl2-card-text">{result.text}</p>
        </div>
      </div>
      <div className="pp-paper pl2-card pl2-card--paper pl2-hint" style={{ '--h': hintHue } as CSSProperties}>
        <span className="pl2-eyebrow">Что с этим делать</span>
        <p className="pl2-card-text">{result.hint}</p>
      </div>
      <QuizAppCta />
      <div className="pl2-actions pl2-result-actions">
        <button onClick={onShare} className="ds-btn ds-btn--secondary">
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
        {glue('Это игра-наблюдение, а не диагноз. Если тема отозвалась — в приложении есть большой тест схем (116 вопросов) и трекер потребностей.')}
      </p>
      <div className="ds-card ds-card--row pl2-card pl2-result-bridge">
        <p className="pl2-card-text">
          {glue('Хочется разобрать результат с живым специалистом? Автор проекта работает в подходе схема-терапия, онлайн. Первая встреча — 15 минут, бесплатно.')}{' '}
          <a href={AUTHOR_SITE} target="_blank" rel="noopener noreferrer" onClick={() => trackPracticeClick('quiz')} className="pl2-link pl2-nowrap">
            Познакомиться ↗
          </a>
        </p>
      </div>
    </div>
  );
}
