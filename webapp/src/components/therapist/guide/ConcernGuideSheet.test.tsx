// @vitest-environment jsdom
// Лист запроса, вариант A: длинный абзац раздела свёрнут до первой фразы («ещё»), «Цель» и «В кабинете» — целиком,
// пустой раздел не рисуется. Содержание — фикстура.
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ConcernGuide } from '../../../../../shared/src/schemaTherapy/guide';
import { ConcernGuideSheet } from './ConcernGuideSheet';

const LONG = 'Первая фраза раздела про то, откуда берётся запрос у клиента и как он выглядит в жизни. Вторая фраза длиннее и уточняет детали истории, темперамента, привязанности и того, как всё это проявляется в отношениях с близкими людьми и на работе.';
const CONCERN: ConcernGuide = {
  id: 'bpd', name: 'Пограничное расстройство', goal: LONG, essence: 'Суть.', origins: LONG, inSession: LONG, stuck: '  ', sources: '',
};

describe('ConcernGuideSheet', () => {
  it('абзац раздела свёрнут до первой фразы, «ещё» раскрывает; цель и «В кабинете» — целиком; пустой раздел не рисуется', () => {
    render(<MemoryRouter><ConcernGuideSheet concern={CONCERN} onClose={() => {}} /></MemoryRouter>);
    const regions = [...document.querySelectorAll('.gd-page > section[aria-label]')].map((s) => s.getAttribute('aria-label'));
    expect(regions).toEqual(['Цель', 'Откуда берётся', 'В кабинете']);
    for (const name of ['Цель', 'В кабинете']) {
      expect(within(screen.getByRole('region', { name })).queryByRole('button', { name: 'ещё' })).toBeNull();
    }
    const origins = within(screen.getByRole('region', { name: 'Откуда берётся' }));
    const more = origins.getByRole('button', { name: 'ещё' });
    expect(origins.getByText(/Вторая фраза/).closest('[hidden]')).not.toBeNull();
    fireEvent.click(more);
    expect(origins.getByText(/Вторая фраза/).closest('[hidden]')).toBeNull();
  });
});
