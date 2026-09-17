// @vitest-environment jsdom
// Регрессия на фидбек владельца 2026-08 («для постороннего слово „часть“
// непонятно… вообще непонятно, что происходит на этой странице»): шапка
// шага 5 объясняет, зачем два вопроса, а термин «часть» не звучит нигде на
// экране — он вводится только на следующем шаге (recognition). Тексты — из
// shared/src/case/caseCriterion.ts. Twin webapp CaseCriterionScreen.test.tsx.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CaseCriterionScreen } from './CaseCriterionScreen';
import type {
  CaseCriterionAnswers,
  Tr,
} from '../../../../shared/src/case/caseTypes';

afterEach(() => cleanup());

const tyTr: Tr = (ty) => ty;
const EMPTY: CaseCriterionAnswers = { biggerThanCause: null, talkedDown: null };

function renderScreen(criterion: CaseCriterionAnswers = EMPTY) {
  return render(
    <CaseCriterionScreen
      criterion={criterion}
      onAnswer={vi.fn()}
      onNext={vi.fn()}
      saving={false}
      tr={tyTr}
    />,
  );
}

describe('CaseCriterionScreen — шапка объясняет шаг, термина «часть» нет', () => {
  it('заголовок и подзаголовок из buildCriterionIntro, вопросы дословно', () => {
    renderScreen();
    expect(screen.getByText('Последний шаг — два вопроса')).toBeTruthy();
    expect(
      screen.getByText(
        'Они помогают отличить обычную досаду от реакции, которая включается сама.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Реакция была крупнее повода?')).toBeTruthy();
    expect(
      screen.getByText('Сказать себе „ну и ладно“ — сработало?'),
    ).toBeTruthy();
  });

  it('оба ответа даны → реплика вердикта mode, и «часть» не звучит нигде', () => {
    const { container } = renderScreen({
      biggerThanCause: true,
      talkedDown: false,
    });
    expect(
      screen.getByText(
        'Сильнее повода и само не отпустило — это уже больше, чем досада. Дальше — что это было.',
      ),
    ).toBeTruthy();
    expect(/част/i.test(container.textContent ?? '')).toBe(false);
  });

  it('тап по «Да» первого вопроса уходит в onAnswer с ключом biggerThanCause', () => {
    const onAnswer = vi.fn();
    render(
      <CaseCriterionScreen
        criterion={EMPTY}
        onAnswer={onAnswer}
        onNext={vi.fn()}
        saving={false}
        tr={tyTr}
      />,
    );
    fireEvent.click(screen.getAllByText('Да')[0]);
    expect(onAnswer).toHaveBeenCalledWith('biggerThanCause', true);
  });
});
