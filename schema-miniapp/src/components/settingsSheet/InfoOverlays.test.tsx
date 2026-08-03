// @vitest-environment jsdom
// InfoOverlays — три статичных объясняющих листа настроек (уведомления,
// пара, терапевт) — правило онбординга «откуда это и зачем». Смоук: каждый
// отвечает на «зачем», закрывается через onClose.
//
// Замечание (не в рамках этой правки): тексты используют литеральное «ты»
// без useTr() — с формой «вы» пользователь всё равно увидит «ты» (нарушение
// правила ты/вы CLAUDE.md). Зафиксировано отдельным TODO, не фиксится здесь,
// чтобы не расширять рамки задачи «поднять покрытие».
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  NotifyInfoOverlay,
  PairInfoOverlay,
  TherapistInfoOverlay,
} from './InfoOverlays';

afterEach(() => {
  cleanup();
});

describe('NotifyInfoOverlay', () => {
  it('объясняет, зачем нужны уведомления', () => {
    render(<NotifyInfoOverlay onClose={() => {}} />);
    expect(screen.getByText('Зачем уведомления')).toBeTruthy();
  });

  it('Escape закрывает лист (через BottomSheet onClose)', () => {
    const onClose = vi.fn();
    render(<NotifyInfoOverlay onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('PairInfoOverlay', () => {
  it('объясняет, что виден только индекс дня, без деталей дневника', () => {
    render(<PairInfoOverlay onClose={() => {}} />);
    expect(screen.getByText('Зачем привязывать друга')).toBeTruthy();
    expect(screen.getByText(/индексы дня/)).toBeTruthy();
  });
});

describe('TherapistInfoOverlay', () => {
  it('объясняет, что терапевту видно, а что остаётся под контролем пользователя', () => {
    render(<TherapistInfoOverlay onClose={() => {}} />);
    expect(screen.getByText('Зачем подключать терапевта')).toBeTruthy();
    expect(screen.getByText(/трекер потребностей и задания/)).toBeTruthy();
  });
});
