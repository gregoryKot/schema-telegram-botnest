// @vitest-environment jsdom
// Шов «синоним → основной адрес»: метка источника и хеш не теряются по дороге.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { LinksMovedRedirect } from './LinksMovedRedirect';
import { LINKS_PAGE_ALIASES, LINKS_PAGE_PATH } from './linksAliases';

function Where() {
  const { pathname, search, hash } = useLocation();
  return <p>{pathname + search + hash}</p>;
}

afterEach(cleanup);

describe('LinksMovedRedirect', () => {
  it.each(LINKS_PAGE_ALIASES)('%s?utm_source=instagram#top → /privet с той же меткой и хешем', (alias) => {
    render(
      <MemoryRouter initialEntries={[`${alias}?utm_source=instagram#top`]}>
        <Routes>
          <Route path={alias} element={<LinksMovedRedirect />} />
          <Route path={LINKS_PAGE_PATH} element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('/privet?utm_source=instagram#top')).toBeTruthy();
  });
});
