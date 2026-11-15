// @vitest-environment jsdom
// «История версий» концептуализации: строка версии — зона нажатия не ниже 44px (на телефоне
// была 38), шеврон раскрытия — SVG вместо глифа «▲/▼», подписи раскрытой версии — ds-label.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useState } from 'react';
import { ConceptVersionHistory } from './ConceptVersionHistory';
import type { ClientDetail } from '../clientSheetTypes';
import type { ConceptSnapshot } from '../../../../../shared/src/apiTypes';

afterEach(cleanup);

const SNAPSHOT: ConceptSnapshot = {
  savedAt: '2026-11-01T10:00:00.000Z', schemaIds: ['failure'], modeIds: ['punitive_critic'],
  earlyExperience: 'Строгий отец', unmetNeeds: null, triggers: null, copingStyles: null, goals: null, currentProblems: null,
};

function History() {
  const [expandedSnapshot, setExpandedSnapshot] = useState<number | null>(null);
  const detail = { concept: { history: [SNAPSHOT] }, expandedSnapshot, setExpandedSnapshot, restoreConcept: () => {} };
  return <ConceptVersionHistory detail={detail as unknown as ClientDetail} />;
}

const row = () => screen.getByRole('button', { name: /Версия 1/ });

describe('ConceptVersionHistory: строка версии', () => {
  it('зона нажатия строки не ниже 44px', () => {
    render(<History />);
    expect(parseFloat(row().style.minHeight)).toBeGreaterThanOrEqual(44);
  });

  it('шеврон — SVG без глифа, скрыт от скринридера и переворачивается при раскрытии', () => {
    render(<History />);
    const chevron = () => row().querySelector('[aria-hidden="true"] svg path')?.getAttribute('d');
    const closed = chevron();
    expect(closed).toBeTruthy();
    expect(row().textContent).not.toMatch(/[▲▼]/);
    fireEvent.click(row());
    expect(chevron()).toBeTruthy();
    expect(chevron()).not.toBe(closed);
  });

  it('подписи раскрытой версии — ds-label', () => {
    render(<History />);
    fireEvent.click(row());
    for (const label of ['Схемы', 'Режимы', 'Ранний опыт']) {
      expect(screen.getByText(label).classList.contains('ds-label')).toBe(true);
    }
    expect(document.querySelector('.eyebrow')).toBeNull();
  });
});
