// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ConceptModeLink } from '../../apiTypes';
import { ModeSchemasList } from './ModeSchemasList';

const link = (patch: Partial<ConceptModeLink>): ConceptModeLink => ({
  modeId: 'punitive_critic',
  alias: '',
  schemaIds: [],
  needIds: [],
  origin: '',
  manifest: '',
  strategy: '',
  ...patch,
});

describe('ModeSchemasList', () => {
  it('режимов на карте нет — ничего не рисует', () => {
    const { container } = render(
      <ModeSchemasList
        activeModeIds={[]}
        modeLinks={[link({ schemaIds: ['failure'] })]}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('у режима со связями показывает имена его схем, alias — вместо имени режима', () => {
    render(
      <ModeSchemasList
        activeModeIds={['punitive_critic']}
        modeLinks={[
          link({ alias: 'Судья', schemaIds: ['failure', 'mistrust'] }),
        ]}
      />,
    );
    expect(screen.getByText('Схемы за режимами')).toBeTruthy();
    expect(screen.getByText('Судья')).toBeTruthy();
    expect(screen.queryByText('Карающий Критик')).toBeNull();
    expect(screen.getByText(/Неуспешность/)).toBeTruthy();
    expect(screen.getByText(/Недоверие/)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('без связей — «схемы не привязаны» и ссылка в вид «Схема»; неизвестный режим пропущен', () => {
    const onGoToGraph = vi.fn();
    render(
      <ModeSchemasList
        activeModeIds={['vulnerable_child', 'no_such_mode']}
        modeLinks={[]}
        onGoToGraph={onGoToGraph}
      />,
    );
    expect(screen.getByText('Уязвимый Ребёнок')).toBeTruthy();
    expect(screen.getAllByText('схемы не привязаны')).toHaveLength(1);
    fireEvent.click(
      screen.getByRole('button', { name: /привязать в виде «Схема»/ }),
    );
    expect(onGoToGraph).toHaveBeenCalledTimes(1);
  });

  it('без onGoToGraph ссылки нет; битые modeLinks (не массив) не роняют список', () => {
    render(
      <ModeSchemasList
        activeModeIds={['vulnerable_child']}
        modeLinks={'legacy' as unknown as ConceptModeLink[]}
      />,
    );
    expect(screen.getByText('схемы не привязаны')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
