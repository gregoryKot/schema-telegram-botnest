// @vitest-environment jsdom
// ClientNotesSheet — карточки схем/режимов клиента, как видит терапевт (0%
// покрытия). Только чтение (запись — на стороне клиента, там же кризисная
// детекция). Проверяет: честное пустое состояние (правило CLAUDE.md), поля
// карточки фильтруются по непустому значению (пустые поля не рисуют пустой
// заголовок), неизвестный schemaId/modeId не падает — фолбэк на raw id.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ClientNotesSheet } from './ClientNotesSheet';
import type { ClientDetail } from './types';

afterEach(() => {
  cleanup();
});

function makeDetail(overrides: Partial<ClientDetail> = {}): ClientDetail {
  return {
    clientSchemaNotesData: [],
    clientModeNotesData: [],
    setShowClientNotesSheet: () => {},
    ...overrides,
  } as unknown as ClientDetail;
}

describe('ClientNotesSheet — пустое состояние', () => {
  it('нет ни одной карточки — честное сообщение, не пустой блок', () => {
    render(<ClientNotesSheet detail={makeDetail()} />);
    expect(
      screen.getByText('Клиент ещё не заполнил карточки схем или режимов'),
    ).toBeTruthy();
  });
});

describe('ClientNotesSheet — карточки схем', () => {
  it('показывает название и заполненные поля', () => {
    render(
      <ClientNotesSheet
        detail={makeDetail({
          clientSchemaNotesData: [
            {
              schemaId: 'emotional_deprivation',
              triggers: 'Когда игнорируют',
              feelings: '',
              thoughts: '',
              origins: '',
              reality: '',
              healthyView: '',
              behavior: '',
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(/Эмоциональная депривация/)).toBeTruthy();
    expect(screen.getByText('Триггеры')).toBeTruthy();
    expect(screen.getByText('Когда игнорируют')).toBeTruthy();
    // Пустые поля не рисуются вовсе.
    expect(screen.queryByText('Чувства')).toBeNull();
  });

  it('все поля пустые — «Не заполнено» вместо пустой карточки', () => {
    render(
      <ClientNotesSheet
        detail={makeDetail({
          clientSchemaNotesData: [
            {
              schemaId: 'emotional_deprivation',
              triggers: '',
              feelings: '',
              thoughts: '',
              origins: '',
              reality: '',
              healthyView: '',
              behavior: '',
            },
          ],
        })}
      />,
    );
    expect(screen.getByText('Не заполнено')).toBeTruthy();
  });

  it('неизвестный schemaId — фолбэк на сырой id, не падает', () => {
    render(
      <ClientNotesSheet
        detail={makeDetail({
          clientSchemaNotesData: [
            { schemaId: 'nonexistent_schema', triggers: 'X' },
          ] as unknown as ClientDetail['clientSchemaNotesData'],
        })}
      />,
    );
    expect(screen.getByText(/nonexistent_schema/)).toBeTruthy();
  });

  it('счётчик в заголовке секции совпадает с числом карточек', () => {
    render(
      <ClientNotesSheet
        detail={makeDetail({
          clientSchemaNotesData: [
            { schemaId: 'emotional_deprivation', triggers: 'A' },
            { schemaId: 'abandonment', triggers: 'B' },
          ] as unknown as ClientDetail['clientSchemaNotesData'],
        })}
      />,
    );
    expect(screen.getByText('Схемы · 2')).toBeTruthy();
  });
});

describe('ClientNotesSheet — карточки режимов', () => {
  it('показывает название и заполненные поля режима', () => {
    render(
      <ClientNotesSheet
        detail={makeDetail({
          clientModeNotesData: [
            {
              modeId: 'vulnerable_child',
              triggers: 'Критика',
              feelings: '',
              thoughts: '',
              needs: 'Поддержка',
              behavior: '',
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(/Уязвимый Ребёнок/)).toBeTruthy();
    expect(screen.getByText('Потребности')).toBeTruthy();
    expect(screen.getByText('Поддержка')).toBeTruthy();
  });

  it('неизвестный modeId — фолбэк на сырой id, не падает', () => {
    render(
      <ClientNotesSheet
        detail={makeDetail({
          clientModeNotesData: [
            { modeId: 'nonexistent_mode', triggers: 'X' },
          ] as unknown as ClientDetail['clientModeNotesData'],
        })}
      />,
    );
    expect(screen.getByText(/nonexistent_mode/)).toBeTruthy();
  });
});

describe('ClientNotesSheet — обе секции одновременно', () => {
  it('и схемы, и режимы заполнены — обе секции видны', () => {
    render(
      <ClientNotesSheet
        detail={makeDetail({
          clientSchemaNotesData: [
            { schemaId: 'emotional_deprivation', triggers: 'A' },
          ] as unknown as ClientDetail['clientSchemaNotesData'],
          clientModeNotesData: [
            { modeId: 'vulnerable_child', triggers: 'B' },
          ] as unknown as ClientDetail['clientModeNotesData'],
        })}
      />,
    );
    expect(screen.getByText('Схемы · 1')).toBeTruthy();
    expect(screen.getByText('Режимы · 1')).toBeTruthy();
  });
});
