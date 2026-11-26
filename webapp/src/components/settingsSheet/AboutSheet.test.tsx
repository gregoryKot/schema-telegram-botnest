// @vitest-environment jsdom
// «О приложении» в настройках: в списке — одна строка, длинный текст («зачем
// это всё», пять потребностей, ссылки) — в листе по нажатию.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AboutSection } from './ShareAboutSections';
import { NEEDS_EXPLAINER } from '../../../../shared/src/about/aboutData';

afterEach(cleanup);
// Абзацы идут через glue (неразрывные пробелы, связка у диапазона «3–5») — сверяем слова, а не пробелы.
const WHY_TERM = /Через\s3\S*–\S*5\sдней\sпаттерн/;
const setup = () => render(<MemoryRouter><AboutSection /></MemoryRouter>);

describe('AboutSection', () => {
  it('в списке настроек — только строка, развёрнутого текста нет', () => {
    setup();
    expect(screen.getByRole('button', { name: /О приложении/ })).toBeTruthy();
    expect(screen.queryByText(WHY_TERM)).toBeNull();
    expect(screen.queryByText('Пять потребностей')).toBeNull();
  });

  it('нажатие открывает лист: «зачем», все пять потребностей, ссылки, оговорка', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /О приложении/ }));
    expect(screen.getByText(WHY_TERM)).toBeTruthy();
    for (const n of NEEDS_EXPLAINER) expect(screen.getByText(new RegExp(n.name))).toBeTruthy();
    expect(screen.getByText(/@SchemeHappens/)).toBeTruthy();
    expect(screen.getByText(/не медицинский и не психологический сервис/)).toBeTruthy();
  });

  it('«Закрыть» убирает лист, строка остаётся', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /О приложении/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Закрыть' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: /О приложении/ })).toBeTruthy();
  });
});
