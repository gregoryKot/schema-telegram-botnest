// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describeCrisisField } from '../../../../test-support/crisisCardHarness';
import { GuideMarkSheet } from './GuideMarkSheet';

vi.mock('../../../../api', () => ({
  api: { getGuideMarks: vi.fn(), getGuideMarkClients: vi.fn(), getTherapyClients: vi.fn(), trackEvent: vi.fn() },
  reportClientError: vi.fn(),
}));

describeCrisisField('webapp/src/components/therapist/guide/marks/GuideMarkSheet.tsx', {
  label: 'заметка «как это у клиента»',
  open: () => render(
    <MemoryRouter>
      <GuideMarkSheet
        address="schema/x/inSession" title="Покорность · В кабинете" client={{ id: 11, name: 'Анна' }}
        onSave={vi.fn()} onRemove={vi.fn()} onClose={vi.fn()}
      />
    </MemoryRouter>,
  ),
  enter: (text) => fireEvent.change(screen.getByLabelText('Как это у клиента'), { target: { value: text } }),
});
