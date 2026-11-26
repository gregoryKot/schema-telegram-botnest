// @vitest-environment jsdom
// Поделиться разбором «Критик или забота?» + блок ShareTwoOptions: одна
// ссылка «Поделиться →», выбор карточки — в шторке. Лист, шторка и ссылка
// приходят инъекцией площадки, здесь — поддельные.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PhraseCheckShare } from './PhraseCheckShare';
import type { ShareCardSheetProps } from './shareCardSheetProps';
import type { SharePickSheetProps } from './ShareTwoOptions';

afterEach(cleanup);

const Sheet = (p: ShareCardSheetProps) => (
  <div data-testid="sheet" data-z={p.zIndex}>
    {p.title}
    <button onClick={p.onClose}>закрыть</button>
  </div>
);
const Picker = (p: SharePickSheetProps) => (
  <div data-testid="picker" data-z={p.zIndex}>
    {p.title}
    {p.options.map((o) => (
      <button key={o.id} onClick={() => p.onPick(o.id)}>
        {o.label}: {o.hint}
      </button>
    ))}
    <button onClick={p.onClose}>закрыть шторку</button>
  </div>
);
const Link = ({ label, onClick }: { label: string; onClick: () => void }) => (
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
      Picker={Picker}
      Link={Link}
      zIndex={330}
    />,
  );

const openLink = () => fireEvent.click(screen.getByText('Поделиться →'));

describe('PhraseCheckShare', () => {
  it('одна ссылка; с переписанной фразой — шторка выбора, краткая карточка открывает свой лист', () => {
    wrap('бывает, поправимо');
    expect(screen.getAllByRole('button')).toHaveLength(1);
    openLink();
    expect(screen.getByTestId('picker').getAttribute('data-z')).toBe('330');
    expect(screen.getByText('Чем поделиться?')).toBeTruthy();
    fireEvent.click(
      screen.getByText(
        'Краткая карточка: На карточке — только две реплики: было и стало.',
      ),
    );
    expect(screen.queryByTestId('picker')).toBeNull();
    expect(screen.getByTestId('sheet').textContent).toContain(
      'Сохранить карточку',
    );
    expect(screen.getByTestId('sheet').getAttribute('data-z')).toBe('330');
    fireEvent.click(screen.getByText('закрыть'));
    expect(screen.queryByTestId('sheet')).toBeNull();
  });

  it('«Весь разбор» отдаёт полную карточку', () => {
    wrap('бывает, поправимо');
    openLink();
    fireEvent.click(screen.getByText(/^Весь разбор: На полной карточке/));
    expect(screen.getByTestId('sheet').textContent).toContain(
      'Поделиться разбором',
    );
  });

  it('шторку можно закрыть без выбора — ничего не открыто', () => {
    wrap('бывает, поправимо');
    openLink();
    fireEvent.click(screen.getByText('закрыть шторку'));
    expect(screen.queryByTestId('picker')).toBeNull();
    expect(screen.queryByTestId('sheet')).toBeNull();
  });

  it('без переписанной фразы ссылка сразу открывает полный разбор, без шторки', () => {
    wrap();
    openLink();
    expect(screen.queryByTestId('picker')).toBeNull();
    expect(screen.getByTestId('sheet').textContent).toContain(
      'Поделиться разбором',
    );
  });

  it('нет ни фразы, ни разбора — блок пуст', () => {
    const { container } = render(
      <PhraseCheckShare
        phrase=""
        marks={[]}
        link="t.me/x"
        Sheet={Sheet}
        Picker={Picker}
        Link={Link}
      />,
    );
    expect(container.textContent).toBe('');
  });
});
