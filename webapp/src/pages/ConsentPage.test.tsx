// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConsentPage } from './ConsentPage';
import { OPERATOR_NAME, OPERATOR_INN, OPERATOR_PD_REGISTRY_NO } from '../legal/operator';
import { CONSENT_VERSION } from '../../../shared/src/onboarding/consents';

afterEach(cleanup);

// Версия, которую хранит сервис, и дата «Редакции от» на странице — одна константа.
describe('ConsentPage', () => {
  it('редакция на странице — из CONSENT_VERSION, реквизиты оператора — из operator.ts', () => {
    const { container } = render(<MemoryRouter><ConsentPage /></MemoryRouter>);
    const [year, month, day] = CONSENT_VERSION.split('-').map(Number);
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    expect(container.textContent).toContain(`Редакция от ${day} ${months[month - 1]} ${year} г.`);
    expect(screen.getAllByText(OPERATOR_NAME).length).toBeGreaterThan(0);
    expect(screen.getAllByText(OPERATOR_INN).length).toBeGreaterThan(0);
    expect(screen.getAllByText(OPERATOR_PD_REGISTRY_NO).length).toBeGreaterThan(0);
  });
});
