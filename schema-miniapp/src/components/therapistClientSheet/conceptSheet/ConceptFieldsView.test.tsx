// @vitest-environment jsdom
// Вид «Поля» в мини-аппе: под чипами режимов видны схемы, привязанные к режимам
// (общий ModeSchemasList — паритет с ConceptModeCard сайта, правило №3, #879).
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from '@testing-library/react';
import { ConceptFieldsView } from './ConceptFieldsView';
import type { ClientDetail } from '../types';
import type { ClientConceptualization } from '../../../api';

afterEach(() => cleanup());

// Имена схем есть и в чипах «Актуальные схемы» выше — ищем внутри блока списка.
const schemasList = () =>
  within(screen.getByText('Схемы за режимами').parentElement as HTMLElement);

const modeLink = (
  patch: Partial<ClientConceptualization['modeLinks'][number]>,
): ClientConceptualization['modeLinks'][number] => ({
  modeId: 'punitive_critic',
  alias: '',
  schemaIds: [],
  needIds: [],
  origin: '',
  manifest: '',
  strategy: '',
  ...patch,
});

function makeDetail(overrides: Partial<ClientDetail> = {}): ClientDetail {
  return {
    concept: null,
    localConcept: {},
    activeSchemaIds: [],
    ysqSchemaIds: [],
    activeModeIds: [],
    patchConcept: vi.fn(),
    toggleSchemaId: vi.fn(),
    toggleModeId: vi.fn(),
    ...overrides,
  } as unknown as ClientDetail;
}

describe('ConceptFieldsView — схемы за режимами', () => {
  it('режим со схемой в серверных modeLinks → имя схемы в списке под чипами', () => {
    render(
      <ConceptFieldsView
        detail={makeDetail({
          activeModeIds: ['punitive_critic'],
          concept: {
            modeLinks: [modeLink({ schemaIds: ['failure'] })],
          } as unknown as ClientDetail['concept'],
        })}
      />,
    );
    expect(schemasList().getByText('Неуспешность')).toBeTruthy();
  });

  it('черновик modeLinks сильнее серверного: показывает схему из localConcept', () => {
    render(
      <ConceptFieldsView
        detail={makeDetail({
          activeModeIds: ['punitive_critic'],
          concept: {
            modeLinks: [modeLink({ schemaIds: ['failure'] })],
          } as unknown as ClientDetail['concept'],
          localConcept: { modeLinks: [modeLink({ schemaIds: ['mistrust'] })] },
        })}
      />,
    );
    expect(
      schemasList().getByText('Недоверие / Ожидание жестокого обращения'),
    ).toBeTruthy();
    expect(schemasList().queryByText('Неуспешность')).toBeNull();
  });

  it('режим без связей — «схемы не привязаны», ссылка ведёт в вид «Схема»', () => {
    const onGoToGraph = vi.fn();
    render(
      <ConceptFieldsView
        detail={makeDetail({ activeModeIds: ['punitive_critic'] })}
        onGoToGraph={onGoToGraph}
      />,
    );
    expect(screen.getByText(/схемы не привязаны/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: /привязать в виде «Схема»/ }),
    );
    expect(onGoToGraph).toHaveBeenCalledTimes(1);
  });

  it('режимов нет — списка схем за режимами нет', () => {
    render(<ConceptFieldsView detail={makeDetail()} />);
    expect(screen.queryByText('Схемы за режимами')).toBeNull();
  });
});
