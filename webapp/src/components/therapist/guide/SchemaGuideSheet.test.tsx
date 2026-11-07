// @vitest-environment jsdom
// Лист схемы (#995): герой — суть и знак домена, разделы справочника по порядку,
// пустые не рисуются, фраза репарентинга — «Как это звучит» репликой в кавычках,
// под «Подробнее» (закрыто) — копинг, типичные режимы (названиями из реестра, id
// без режима пропускается), общее для домена и «Где застревают»; техника ведёт в
// лист техники, «Дать заданием» отдаёт пункт. Содержание — фикстура, не тексты
// shared/src/schemaTherapy/guide/.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SchemaGuideSheet } from './SchemaGuideSheet';
import type { SchemaGuideView } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide';
import {
  FIXTURE_DOMAIN_NOTE,
  FIXTURE_SCHEMA_GUIDE,
  FIXTURE_SCHEMA_VIEW,
} from '../../../../../shared/src/therapy/conceptGraph/conceptGuide.fixture';

const NAME = 'Покинутость / Нестабильность';
const regions = () => screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'));
const region = (name: string) => within(screen.getByRole('region', { name }));
const openMore = () => fireEvent.click(screen.getByRole('button', { name: 'Подробнее' }));

function renderSheet(view: SchemaGuideView = FIXTURE_SCHEMA_VIEW, onAssign?: (item: unknown) => void) {
  const onOpenTechnique = vi.fn();
  render(
    <MemoryRouter>
      <SchemaGuideSheet
        schemaName={NAME} view={view}
        onOpenTechnique={onOpenTechnique} onAssign={onAssign} onClose={() => {}}
      />
    </MemoryRouter>,
  );
  return { onOpenTechnique };
}

describe('SchemaGuideSheet', () => {
  it('герой — суть и знак домена; разделы по порядку; копинг, режимы, домен и «Где застревают» — под «Подробнее»', () => {
    renderSheet(FIXTURE_SCHEMA_VIEW, vi.fn());
    const dialog = screen.getByRole('dialog', { name: NAME });
    expect(within(dialog).getByRole('heading', { level: 2, name: NAME })).toBeTruthy();
    expect(within(dialog).getByText(FIXTURE_SCHEMA_GUIDE.essence)).toBeTruthy();
    expect(dialog.querySelector('svg.pp-art--hero')).toBeTruthy();
    expect(regions()).toEqual([
      'Как это звучит', 'Потребность', 'В кабинете', 'Что делать', 'На сессии', 'Между сессиями', 'Источники',
    ]);
    expect(screen.queryByText(FIXTURE_DOMAIN_NOTE)).toBeNull();
    openMore();
    expect(regions()).toEqual([
      'Как это звучит', 'Потребность', 'В кабинете', 'Что делать', 'На сессии', 'Между сессиями',
      'Копинг', 'Типичные режимы', 'Общее для домена', 'Где застревают', 'Источники',
    ]);
    expect(region('Общее для домена').getByText(FIXTURE_DOMAIN_NOTE)).toBeTruthy();
    expect(screen.getByText(FIXTURE_SCHEMA_GUIDE.sources)).toBeTruthy();
  });

  it('копинг — три стиля подписью и строкой', () => {
    renderSheet();
    openMore();
    const coping = region('Копинг');
    expect(coping.getAllByRole('term').map((t) => t.textContent)).toEqual(['Капитуляция', 'Избегание', 'Гиперкомпенсация']);
    expect(coping.getByText(FIXTURE_SCHEMA_GUIDE.coping.avoidance)).toBeTruthy();
  });

  it('типичные режимы — названиями из реестра, неизвестный id пропущен', () => {
    renderSheet();
    openMore();
    expect(region('Типичные режимы').getByText('Покинутый Ребёнок, Сердитый Ребёнок')).toBeTruthy();
    expect(screen.queryByText(/abandoned_child|нет_такого_режима/)).toBeNull();
  });

  it('фраза репарентинга — «Как это звучит»: реплика, кавычки ставит лист; за ней реплики voice', () => {
    renderSheet({ ...FIXTURE_SCHEMA_VIEW, guide: { ...FIXTURE_SCHEMA_GUIDE, voice: ['Разберёмся вместе'] } });
    const quotes = region('Как это звучит').getAllByText(/^«/);
    expect(quotes.map((q) => [q.tagName, q.textContent])).toEqual([
      ['BLOCKQUOTE', `«${FIXTURE_SCHEMA_GUIDE.reparenting}»`],
      ['BLOCKQUOTE', '«Разберёмся вместе»'],
    ]);
  });

  it('интервенции — пункты «Что делать»', () => {
    renderSheet();
    const items = region('Что делать').getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual(FIXTURE_SCHEMA_GUIDE.interventions);
  });

  it('пустое не показывается: без копинга, режимов, домена, репарентинга, интервенций и «Где застревают» нет и «Подробнее»', () => {
    const guide = {
      ...FIXTURE_SCHEMA_GUIDE,
      coping: { surrender: '', avoidance: '  ', overcompensation: '' },
      modeIds: ['нет_такого_режима'],
      reparenting: ' ',
      interventions: [],
      stuck: undefined,
      inSession: '',
    };
    renderSheet({ ...FIXTURE_SCHEMA_VIEW, guide, domainNote: '' });
    expect(regions()).toEqual(['Потребность', 'На сессии', 'Между сессиями', 'Источники']);
    expect(screen.queryByRole('button', { name: 'Подробнее' })).toBeNull();
    expect(screen.queryByText('«»')).toBeNull();
  });

  it('один стиль копинга пуст — его строки нет, раздел остаётся', () => {
    renderSheet({ ...FIXTURE_SCHEMA_VIEW, guide: { ...FIXTURE_SCHEMA_GUIDE, coping: { ...FIXTURE_SCHEMA_GUIDE.coping, avoidance: '' } } });
    openMore();
    expect(region('Копинг').getAllByRole('term').map((t) => t.textContent)).toEqual(['Капитуляция', 'Гиперкомпенсация']);
  });

  it('техника — кнопка в порядке вида; тап зовёт лист техники', () => {
    const { onOpenTechnique } = renderSheet();
    const session = region('На сессии');
    expect(session.getAllByRole('button').map((b) => b.textContent)).toEqual(['Работа со стульями', 'Рескриптинг образов']);
    fireEvent.click(session.getByRole('button', { name: 'Рескриптинг образов' }));
    expect(onOpenTechnique).toHaveBeenCalledWith('imagery_rescripting');
  });

  it('«Дать заданием» отдаёт пункт; без onAssign кнопок нет', () => {
    const onAssign = vi.fn();
    renderSheet(FIXTURE_SCHEMA_VIEW, onAssign);
    fireEvent.click(region('Между сессиями').getByRole('button', { name: 'Дать заданием: Карточка схемы' }));
    expect(onAssign).toHaveBeenCalledWith(FIXTURE_SCHEMA_GUIDE.betweenSessions[0]);
  });

  it('без onAssign (справочник без клиента) — пункты есть, кнопок задания нет', () => {
    renderSheet();
    expect(region('Между сессиями').getByText('Дневник разлук')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Дать заданием/ })).toBeNull();
  });
});
