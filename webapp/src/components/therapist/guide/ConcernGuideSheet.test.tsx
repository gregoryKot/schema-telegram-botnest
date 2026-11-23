// @vitest-environment jsdom
// Лист запроса вкладками: абзац раздела свёрнут до первой фразы («ещё»), «Цель» и «В кабинете» — целиком, пустой раздел
// не рисуется; режимы, схемы и техники — переходами. Содержание — фикстура.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ConcernGuide } from '../../../../../shared/src/schemaTherapy/guide';
import { FIXTURE_TECHNIQUES } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide.fixture';
import { ConcernGuideSheet } from './ConcernGuideSheet';

const LONG = 'Первая фраза раздела про то, откуда берётся запрос у клиента и как он выглядит в жизни. Вторая фраза длиннее и уточняет детали истории, темперамента, привязанности и того, как всё это проявляется в отношениях с близкими людьми и на работе.';
const CONCERN: ConcernGuide = {
  id: 'bpd', name: 'Пограничное расстройство', goal: LONG, essence: 'Суть.', origins: LONG, inSession: LONG, stuck: '  ', sources: '',
};
const tab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }));
const regions = () => screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'));

describe('ConcernGuideSheet', () => {
  it('разделы лежат на своих вкладках; «ещё» раскрывает абзац; цель и «В кабинете» — целиком; пустой раздел не рисуется', () => {
    render(<MemoryRouter><ConcernGuideSheet concern={CONCERN} onClose={() => {}} /></MemoryRouter>);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Кратко', 'Диагностика', 'На сессии']);
    expect(regions()).toEqual(['Цель']);
    tab('Диагностика');
    const origins = within(screen.getByRole('region', { name: 'Откуда берётся' }));
    const more = origins.getByRole('button', { name: 'ещё' });
    expect(origins.getByText(/Вторая фраза/).closest('[hidden]')).not.toBeNull();
    fireEvent.click(more);
    expect(origins.getByText(/Вторая фраза/).closest('[hidden]')).toBeNull();
    tab('На сессии');
    expect(regions()).toEqual(['В кабинете']);
    expect(within(screen.getByRole('region', { name: 'В кабинете' })).queryByRole('button', { name: 'ещё' })).toBeNull();
  });

  it('режимы и схемы — строками «Связано» на «Кратко», тап зовёт их лист; техники — на «На сессии»', () => {
    const [onMode, onSchema, onTechnique] = [vi.fn(), vi.fn(), vi.fn()];
    const concern = { ...CONCERN, modeIds: ['detached_protector', 'нет_такого'], schemaIds: ['failure'], techniques: [FIXTURE_TECHNIQUES[0].id] };
    render(
      <MemoryRouter>
        <ConcernGuideSheet
          concern={concern} techniques={[FIXTURE_TECHNIQUES[0]]} onOpenMode={onMode} onOpenSchema={onSchema} onOpenTechnique={onTechnique} onClose={() => {}}
        />
      </MemoryRouter>,
    );
    const related = within(screen.getByRole('region', { name: 'Связано' }));
    expect(related.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual(['Типичные режимы', 'Типичные схемы']);
    const [mode, schema] = related.getAllByRole('button');
    fireEvent.click(mode);
    fireEvent.click(schema);
    expect(onMode).toHaveBeenCalledWith('detached_protector');
    expect(onSchema).toHaveBeenCalledWith('failure');
    tab('На сессии');
    fireEvent.click(screen.getByRole('button', { name: FIXTURE_TECHNIQUES[0].name }));
    expect(onTechnique).toHaveBeenCalledWith(FIXTURE_TECHNIQUES[0].id);
  });
});
