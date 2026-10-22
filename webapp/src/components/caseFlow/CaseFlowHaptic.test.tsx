// @vitest-environment jsdom
// Тактильный отклик в потоке «Разбор случая» (паритет с мини-аппом): тап по
// имени-заготовке, по примеру сцены и по «Пропустить →» даёт haptic.tap().
// Раньше на сайте он был только у выбора режима и кнопки «Назад».
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CaseNameScreen } from './CaseNameScreen';
import { CaseSceneScreen } from './CaseSceneScreen';
import { CASE_FRAMES } from '../../../../shared/src/case/caseFrames';
import type { Tr } from '../../../../shared/src/case/caseTypes';

const tap = vi.hoisted(() => vi.fn());
vi.mock('../../haptic', () => ({ haptic: { tap, select: vi.fn() } }));

const tyTr: Tr = (ty) => ty;

beforeEach(() => tap.mockClear());
afterEach(() => cleanup());

function renderName(onConfirm = vi.fn()) {
  render(
    <CaseNameScreen
      impulseChipIds={['impulse_close']}
      saving={false}
      onBack={vi.fn()}
      onConfirm={onConfirm}
      onLater={vi.fn()}
      crisis={false}
      onHardNow={vi.fn()}
      tr={tyTr}
    />,
  );
  return onConfirm;
}

describe('Разбор случая — haptic на тапах', () => {
  it('чип-заготовка имени: отклик и подтверждение с источником chip', () => {
    const onConfirm = renderName();
    fireEvent.click(screen.getByRole('button', { name: 'Стена' }));
    expect(tap).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('Стена', 'chip');
  });

  it('«Пропустить →» (TertiaryLink): отклик и пропуск имени', () => {
    const onConfirm = renderName();
    fireEvent.click(screen.getByText('Пропустить →'));
    expect(tap).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('', 'skipped');
  });

  it('пример сцены: отклик и выбор примера', () => {
    const onPickFrame = vi.fn();
    render(
      <CaseSceneScreen
        value=""
        chosenFrame=""
        onChange={vi.fn()}
        onPickFrame={onPickFrame}
        onBack={vi.fn()}
        onNext={vi.fn()}
        onLater={vi.fn()}
        crisis={false}
        onHardNow={vi.fn()}
        tr={tyTr}
      />,
    );
    fireEvent.click(screen.getByText('Не идёт — начать с примера →'));
    fireEvent.click(screen.getByText(CASE_FRAMES[0]));
    expect(tap).toHaveBeenCalledTimes(1);
    expect(onPickFrame).toHaveBeenCalledWith(CASE_FRAMES[0]);
  });
});
