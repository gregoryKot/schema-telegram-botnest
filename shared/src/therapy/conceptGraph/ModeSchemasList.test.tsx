// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ConceptModeLink } from '../../apiTypes';
import { ModeSchemasList } from './ModeSchemasList';
import { ConceptSkinContext, type ConceptSkin } from './conceptSkin';
import { DOMAIN_HUE, MODE_GROUP_HUE } from '../../theme/entityHue';

const SKIN: ConceptSkin = {
  seg: { group: 'sk-seg', btn: 'sk-seg-btn' },
  chip: 'sk-chip',
  tag: 'sk-tag',
  dot: 'sk-dot',
  label: 'sk-label',
  link: 'sk-link',
  card: 'sk-card',
  fold: { root: 'f-root', btn: 'f-btn', chev: 'f-chev', body: 'f-body' },
};

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

  it('со skin: ярлык, точка группы, теги доменов и ссылка — классами, без цветного инлайна', () => {
    const onGo = vi.fn();
    render(
      <ConceptSkinContext.Provider value={SKIN}>
        <ModeSchemasList
          activeModeIds={['punitive_critic', 'vulnerable_child']}
          modeLinks={[
            link({ schemaIds: ['failure'] }),
            link({ modeId: 'vulnerable_child' }),
          ]}
          onGoToGraph={onGo}
        />
      </ConceptSkinContext.Provider>,
    );
    expect(screen.getByText('Схемы за режимами').className).toBe('sk-label');
    const dot = screen
      .getByText('Карающий Критик')
      .querySelector('.sk-dot') as HTMLElement;
    expect(dot.style.getPropertyValue('--h')).toBe(
      String(MODE_GROUP_HUE.critic),
    );
    const tag = screen.getByText('Неуспешность');
    expect(tag.className).toBe('sk-tag');
    expect(tag.style.getPropertyValue('--h')).toBe(String(DOMAIN_HUE.autonomy));
    expect(tag.style.background).toBe('');
    const link2 = screen.getByRole('button', { name: /привязать/ });
    expect(link2.className).toBe('sk-link');
    expect(link2.getAttribute('style')).toBeNull();
    fireEvent.click(link2);
    expect(onGo).toHaveBeenCalled();
  });
});
