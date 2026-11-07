// @vitest-environment jsdom
// Хост «разбор ⇄ карта»: стартует с нужного экрана, переключается между ними
// и закрывается одним onClose.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CaseFlowHost } from './CaseFlowHost';

vi.mock('../../api', () => ({
  api: { createModeDiary: vi.fn(), saveModeNote: vi.fn() },
}));
vi.mock('./CaseFlowScreen', () => ({
  CaseFlowScreen: (p: { onOpenMap: () => void; onClose: () => void }) => (
    <div>
      <span>flow</span>
      <button onClick={p.onOpenMap}>to-map</button>
      <button onClick={p.onClose}>close-flow</button>
    </div>
  ),
}));
vi.mock('../selfMap/SelfMapOverlay', () => ({
  SelfMapOverlay: (p: { onStartCase: () => void; onClose: () => void }) => (
    <div>
      <span>map</span>
      <button onClick={p.onStartCase}>to-flow</button>
      <button onClick={p.onClose}>close-map</button>
    </div>
  ),
}));

const props = {
  onClose: vi.fn(),
  onOpenTracker: vi.fn(),
  onOpenSchema: vi.fn(),
};

describe('CaseFlowHost', () => {
  it('start=flow показывает поток, оттуда можно в карту и обратно', async () => {
    render(<CaseFlowHost start="flow" {...props} />);
    expect(await screen.findByText('flow')).toBeTruthy();
    fireEvent.click(screen.getByText('to-map'));
    expect(await screen.findByText('map')).toBeTruthy();
    fireEvent.click(screen.getByText('to-flow'));
    expect(await screen.findByText('flow')).toBeTruthy();
  });

  it('start=map открывается сразу на карте; закрытие зовёт onClose', async () => {
    const onClose = vi.fn();
    render(<CaseFlowHost start="map" {...props} onClose={onClose} />);
    fireEvent.click(await screen.findByText('close-map'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
