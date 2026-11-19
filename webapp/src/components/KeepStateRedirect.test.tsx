// @vitest-environment jsdom
// Старый адрес /exercises ведёт в «Практики»; состояние маршрута (что открыть) редирект обязан донести.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { KeepStateRedirect } from './KeepStateRedirect';

function Probe() {
  const { pathname, search, state } = useLocation();
  return <div data-testid="at">{JSON.stringify({ pathname, search, state })}</div>;
}

describe('KeepStateRedirect', () => {
  it('переносит состояние и параметры на новый адрес', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/exercises', search: '?a=1', state: { openSchemaEx: 'abandonment' } }]}>
        <Routes>
          <Route path="/exercises" element={<KeepStateRedirect to="/practice" />} />
          <Route path="/practice" element={<Probe />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(JSON.parse(screen.getByTestId('at').textContent ?? '')).toEqual({ pathname: '/practice', search: '?a=1', state: { openSchemaEx: 'abandonment' } });
  });
});
