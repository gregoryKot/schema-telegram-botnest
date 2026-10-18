// @vitest-environment jsdom
// Поделиться разбором «Критик или забота?» + блок ShareTwoOptions (webapp ↔
// miniapp, правило №3): лист и кнопка приходят инъекцией, здесь — поддельные.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PhraseCheckShare } from './PhraseCheckShare';
import type { ShareCardSheetProps } from './shareCardSheetProps';

afterEach(cleanup);

const Sheet = (p: ShareCardSheetProps) => (
  <div data-testid="sheet" data-z={p.zIndex}>
    {p.title}
    <button onClick={p.onClose}>закрыть</button>
  </div>
);
const Pill = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button onClick={onClick}>{label}</button>
);

const wrap = (rewrite?: string) =>
  render(
    <PhraseCheckShare
      phrase="я всё порчу"
      marks={['worth']}
      rewrite={rewrite}
      link="t.me/x"
      Sheet={Sheet}
      Pill={Pill}
      zIndex={330}
    />,
  );

describe('PhraseCheckShare', () => {
  it('с переписанной фразой — обе кнопки; краткая открывает лист с zIndex и закрывается', () => {
    wrap('бывает, поправимо');
    expect(
      screen.getByText('На карточке — только две реплики: было и стало.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByText('Поделиться карточкой'));
    expect(screen.getByTestId('sheet').getAttribute('data-z')).toBe('330');
    fireEvent.click(screen.getByText('закрыть'));
    expect(screen.queryByTestId('sheet')).toBeNull();
  });

  it('полный разбор открывает свой лист', () => {
    wrap('бывает, поправимо');
    fireEvent.click(screen.getByText('Поделиться всем разбором'));
    expect(screen.getByTestId('sheet')).toBeTruthy();
  });

  it('без переписанной фразы краткой кнопки нет', () => {
    wrap();
    expect(screen.queryByText('Поделиться карточкой')).toBeNull();
    expect(screen.getByText('Поделиться всем разбором')).toBeTruthy();
  });

  it('нет ни фразы, ни разбора — блок пуст', () => {
    const { container } = render(
      <PhraseCheckShare
        phrase=""
        marks={[]}
        link="t.me/x"
        Sheet={Sheet}
        Pill={Pill}
      />,
    );
    expect(container.textContent).toBe('');
  });
});
