// @vitest-environment jsdom
// «Фраза для себя» на телефоне: карточка с подписью, как в мини-аппе.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PhraseShareCard } from './PhraseShareCard';
import { api } from '../api';

vi.mock('./useIsMobile', () => ({ useIsMobile: () => true }));
vi.mock('../api', () => ({ api: { getHealthyPhrase: vi.fn(), trackEvent: vi.fn() } }));
vi.mock('../../../shared/src/share/cards/phraseCard', () => ({ drawPhraseCard: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PhraseShareCard на телефоне', () => {
  it('карточка с подписью и «Другая», без разделительной линии', async () => {
    vi.mocked(api.getHealthyPhrase).mockResolvedValue({ text: 'Можно отдыхать' });
    const { container } = render(<MemoryRouter><PhraseShareCard /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('«Можно отдыхать»')).toBeTruthy());
    expect(screen.getByText('Голос Здорового Взрослого — тёплая опора в моменте')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Другая/ })).toBeTruthy();
    expect(container.querySelector('.ct-phrase')).toBeTruthy();
    expect(container.querySelector('hr')).toBeNull();
  });
});
