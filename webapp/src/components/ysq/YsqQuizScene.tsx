import { SceneQuiz } from '../art/LandingScenesMore';
import { SignHero } from '../paper/SignHero';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';

/** Сцена вступления теста на схемы (ENTITY_LOOK словами: «вступление YSQ — SceneQuiz с Layers»): веер
 *  карточек-вопросов на листе глины, на верхней карточке — знак теста Layers с тенью-вырезкой, как у
 *  вступления мини-тестов (pages/tests/QuizIntro.tsx: то же место на карточке). Декор, aria-hidden. */
export function YsqQuizScene() {
  const { hue, sign } = ENTITY_LOOK.ysq;
  return (
    <span className="ss-quiz-scene" aria-hidden="true">
      <SceneQuiz hue={hue} sign />
      <span className="ss-quiz-sign"><SignHero sign={sign} /></span>
    </span>
  );
}
