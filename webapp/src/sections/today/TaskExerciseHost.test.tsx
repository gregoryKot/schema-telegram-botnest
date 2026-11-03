// @vitest-environment jsdom
// QA 2026-11 (A-М10): задание, открытое с «Сегодня», вело назад кнопкой «Назад
// к упражнениям» — а возвращало на «Сегодня». Подпись задаёт хост упражнений:
// «Сегодня» передаёт «Назад», «Практика» оставляет «Назад к упражнениям».
// Упражнение — заглушка на настоящем ExScreen: проверяется шов хост → шапка.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ExScreen } from '../../components/exercises/ExScreen';
import { TaskExerciseHost } from './TaskExerciseHost';

vi.mock('../../components/exercises/WarmWordsEx', () => ({
  WarmWordsEx: ({ onBack }: { onBack: () => void }) => <ExScreen onBack={onBack} eyebrow="Ресурс" title="Тёплые слова" />,
}));

afterEach(cleanup);

const host = (backLabel?: string) => (
  <TaskExerciseHost open={{ ex: 'warm' }} onBack={vi.fn()} onComplete={vi.fn()} onOpenTracker={vi.fn()} backLabel={backLabel} />
);

describe('TaskExerciseHost — подпись «Назад» в шапке упражнения', () => {
  it('с «Сегодня» (backLabel="Назад") — «Назад», без обещания «к упражнениям»', async () => {
    render(host('Назад'));
    expect(await screen.findByRole('button', { name: 'Назад' })).toBeTruthy();
    expect(screen.queryByText('Назад к упражнениям')).toBeNull();
  });

  it('контрольный: без backLabel (как в «Практике») — «Назад к упражнениям»', async () => {
    render(host());
    expect(await screen.findByRole('button', { name: 'Назад к упражнениям' })).toBeTruthy();
  });
});
