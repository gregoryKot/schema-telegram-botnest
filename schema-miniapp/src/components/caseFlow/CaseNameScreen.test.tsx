// @vitest-environment jsdom
// «Своё слово» на экране имени части уходит на сервер сразу по «Назвать»
// (useCaseFlowSave.confirmName → onSaveCard), а детекция потока видит его лишь
// после этого. Правило №7: карточка телефона доверия — до отправки, поэтому
// черновик поля проверяется на самом экране (аудит 2026-10, `<input>` вне
// кризисного трипваера).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CaseNameScreen } from './CaseNameScreen';
import { CRISIS_HOTLINE_DISPLAY } from '../../utils/crisisMarkers';
import type { Tr } from '../../../../shared/src/case/caseTypes';

vi.mock('../../api', () => ({ api: { trackEvent: vi.fn() } }));

afterEach(() => cleanup());

const tyTr: Tr = (ty) => ty;

function renderScreen(crisisShown = false) {
  const onConfirm = vi.fn();
  render(
    <CaseNameScreen
      impulseChipIds={[]}
      saving={false}
      crisisShown={crisisShown}
      onConfirm={onConfirm}
      tr={tyTr}
    />,
  );
  return { onConfirm, input: screen.getByPlaceholderText('Своё слово') };
}

describe('CaseNameScreen — кризисный путь для своего слова (правило №7)', () => {
  it('кризисная фраза в поле — карточка с телефоном доверия до нажатия «Назвать»', () => {
    const { input, onConfirm } = renderScreen();
    fireEvent.change(input, { target: { value: 'не хочу жить' } });
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('нейтральное имя части — карточки нет', () => {
    const { input } = renderScreen();
    fireEvent.change(input, { target: { value: 'Стена' } });
    expect(screen.queryByText(CRISIS_HOTLINE_DISPLAY)).toBeNull();
  });

  it('карточка уже стоит внизу листа — вторую не рисует', () => {
    const { input } = renderScreen(true);
    fireEvent.change(input, { target: { value: 'не хочу жить' } });
    expect(screen.queryByText(CRISIS_HOTLINE_DISPLAY)).toBeNull();
  });
});
