// @vitest-environment jsdom
// Точка монтирования разбора случая на «Сегодня» (правило CLAUDE.md про
// онбординг: пока этот файл не смонтирован ни одним тестом, реальный API-путь
// разбора никем не проверен). Счётчик прошлых разборов приезжает из
// api.getModeDiary, а onSave/onSaveCard обязаны реально доехать до
// api.createModeDiary/saveModeNote — иначе разбор красиво проходит на экране
// и никуда не сохраняется (та же логика read-after-write, что и в
// notes.service.spec.ts на бэкенде, только на стыке компонент↔API).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { CaseFlowOverlay } from './CaseFlowOverlay';

vi.mock('../../api', () => ({
  api: {
    getModeDiary: vi.fn(),
    createModeDiary: vi.fn(),
    saveModeNote: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
vi.mock('../../haptic', () => ({ haptic: { tap: vi.fn(), select: vi.fn() } }));

import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const SCENE_TEXT = 'Мама позвонила и стала расспрашивать про работу';

function makeSheets() {
  return { close: vi.fn(), open: vi.fn() };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.createModeDiary.mockResolvedValue(undefined);
  mockApi.saveModeNote.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('CaseFlowOverlay — счётчик разборов приезжает из API', () => {
  it('дожидается api.getModeDiary и показывает реальный поток (не заглушку)', async () => {
    mockApi.getModeDiary.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    render(<CaseFlowOverlay sheets={makeSheets()} />);
    await screen.findByText('Разобрать свой случай');
    expect(mockApi.getModeDiary).toHaveBeenCalledTimes(1);
  });
});

describe('CaseFlowOverlay — «Сегодня ровный день»', () => {
  it('закрывает разбор и открывает трекер настроения', async () => {
    mockApi.getModeDiary.mockResolvedValue([]);
    const sheets = makeSheets();
    render(<CaseFlowOverlay sheets={sheets} />);
    await screen.findByText('Сегодня ровный день →');

    fireEvent.click(screen.getByText('Сегодня ровный день →'));
    expect(sheets.close).toHaveBeenCalledWith('caseFlow');
    expect(sheets.open).toHaveBeenCalledWith('trackerOverlay');
  });
});

describe('CaseFlowOverlay — «Тяжело прямо сейчас» на входе', () => {
  it('закрывает разбор без открытия других листов', async () => {
    mockApi.getModeDiary.mockResolvedValue([]);
    const sheets = makeSheets();
    render(<CaseFlowOverlay sheets={sheets} />);
    await screen.findByText('Тяжело прямо сейчас →');

    fireEvent.click(screen.getByText('Тяжело прямо сейчас →'));
    expect(sheets.close).toHaveBeenCalledWith('caseFlow');
    expect(sheets.open).not.toHaveBeenCalled();
  });
});

describe('CaseFlowOverlay — полный проход доезжает до реального API', () => {
  it('onSave/onSaveCard зовут api.createModeDiary/saveModeNote, «Открыть карту» открывает карту', async () => {
    mockApi.getModeDiary.mockResolvedValue([]);
    const sheets = makeSheets();
    render(<CaseFlowOverlay sheets={sheets} />);
    await screen.findByText('Разобрать свой случай');

    fireEvent.click(screen.getByText('Разобрать свой случай'));
    fireEvent.change(
      screen.getByPlaceholderText(/сообщение прочитано час назад/i),
      { target: { value: SCENE_TEXT } },
    );
    fireEvent.click(screen.getByText('Дальше'));
    fireEvent.click(screen.getByText('Страшно, тревожно'));
    fireEvent.click(screen.getByText('Одиноко, страшно, грустно'));
    fireEvent.click(screen.getByText('Дальше')); // тело -> порыв
    fireEvent.click(screen.getByText('Свернуть разговор'));
    fireEvent.click(screen.getByText('Дальше')); // порыв -> критерий

    fireEvent.click(screen.getAllByText('Да')[0]);
    fireEvent.click(screen.getAllByText('Нет')[1]); // -> вердикт «часть»
    fireEvent.click(screen.getByText('Дальше'));

    await waitFor(() =>
      expect(mockApi.createModeDiary).toHaveBeenCalledTimes(1),
    );
    expect(mockApi.createModeDiary).toHaveBeenCalledWith(
      expect.objectContaining({
        modeId: 'vulnerable_child',
        situation: SCENE_TEXT,
      }),
    );

    await screen.findByText('Вот что произошло');
    fireEvent.click(screen.getByText('Дальше')); // recognition -> name
    fireEvent.click(screen.getByText('Стена'));

    await waitFor(() => expect(mockApi.saveModeNote).toHaveBeenCalledTimes(1));
    expect(mockApi.saveModeNote).toHaveBeenCalledWith(
      expect.objectContaining({ modeId: 'vulnerable_child', alias: 'Стена' }),
    );

    await screen.findByText('Открыть карту');
    fireEvent.click(screen.getByText('Открыть карту'));
    expect(sheets.close).toHaveBeenCalledWith('caseFlow');
    expect(sheets.open).toHaveBeenCalledWith('selfMap');
  });
});
