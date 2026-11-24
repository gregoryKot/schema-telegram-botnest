// @vitest-environment jsdom
// Лист схемы (#995): герой — суть и знак домена, разделы справочника по порядку (вариант A),
// пустые не рисуются, фраза репарентинга — «Как это звучит» репликой в кавычках, «Связано» —
// режимы (названиями из реестра, id без режима пропускается); по вкладкам: «Кратко», «На сессии», «Задания»,
// «Теория» (копинг, общее для домена, «Где застревают», источники); техника ведёт в лист техники, «Дать заданием» отдаёт пункт. Содержание — фикстура, не тексты
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
// Разделы всех вкладок (неактивные скрыты hidden="until-found").
const regions = () => screen.getAllByRole('region', { hidden: true }).map((r) => r.getAttribute('aria-label'));
const tab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }));
const region = (name: string) => within(screen.getByRole('region', { name }));

function renderSheet(view: SchemaGuideView = FIXTURE_SCHEMA_VIEW, onAssign?: (item: unknown) => void, onOpenMode?: (id: string) => void) {
  const onOpenTechnique = vi.fn();
  render(
    <MemoryRouter>
      <SchemaGuideSheet
        schemaName={NAME} view={view}
        onOpenTechnique={onOpenTechnique} onAssign={onAssign} onOpenMode={onOpenMode} onClose={() => {}}
      />
    </MemoryRouter>,
  );
  return { onOpenTechnique };
}

describe('SchemaGuideSheet', () => {
  it('герой — суть и знак домена; разделы по вкладкам; копинг, домен и «Где застревают» — на «Теории»', () => {
    renderSheet(FIXTURE_SCHEMA_VIEW, vi.fn());
    const dialog = screen.getByRole('dialog', { name: NAME });
    expect(within(dialog).getByRole('heading', { level: 2, name: NAME })).toBeTruthy();
    expect(within(dialog).getByText(FIXTURE_SCHEMA_GUIDE.essence)).toBeTruthy();
    expect(dialog.querySelector('svg.pp-art--hero')).toBeTruthy();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Кратко', 'На сессии', 'Задания', 'Теория']);
    expect(regions()).toEqual([
      'Как это звучит', 'Потребность', 'Связано', 'Режимы',
      'На сессии', 'В кабинете', 'Что делать', 'Между сессиями',
      'Копинг', 'Общее для домена', 'Где застревают', 'Источники',
    ]);
    tab('Теория');
    expect(region('Общее для домена').getByText(FIXTURE_DOMAIN_NOTE)).toBeTruthy();
    expect(screen.getByText(FIXTURE_SCHEMA_GUIDE.sources)).toBeTruthy();
  });

  it('копинг — три стиля подписью и строкой', () => {
    renderSheet();
    tab('Теория');
    const coping = region('Копинг');
    expect(coping.getAllByRole('term').map((t) => t.textContent)).toEqual(['Капитуляция', 'Избегание', 'Гиперкомпенсация']);
    expect(coping.getByText(FIXTURE_SCHEMA_GUIDE.coping.avoidance)).toBeTruthy();
  });

  it('«Связано»: режимы — названиями из реестра, неизвестный id пропущен', () => {
    renderSheet();
    expect(region('Режимы').getByText('Покинутый Ребёнок, Сердитый Ребёнок')).toBeTruthy();
    expect(screen.queryByText(/abandoned_child|нет_такого_режима/)).toBeNull();
  });

  it('с onOpenMode режимы — чипы-переходы: тап открывает лист режима', () => {
    const onOpenMode = vi.fn();
    renderSheet(FIXTURE_SCHEMA_VIEW, undefined, onOpenMode);
    fireEvent.click(region('Режимы').getByRole('button', { name: /Сердитый Ребёнок/ }));
    expect(onOpenMode).toHaveBeenCalledWith('angry_child');
    expect(region('Режимы').getAllByRole('button')).toHaveLength(2);
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
    tab('На сессии');
    const items = region('Что делать').getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual(FIXTURE_SCHEMA_GUIDE.interventions);
  });

  it('пустое не показывается: без копинга, режимов, домена, репарентинга, интервенций и «Где застревают» на «Теории» одни источники', () => {
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
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Кратко', 'На сессии', 'Задания', 'Теория']);
    expect(screen.queryByRole('button', { name: 'Подробнее' })).toBeNull();
    expect(screen.queryByText('«»')).toBeNull();
  });

  it('один стиль копинга пуст — его строки нет, раздел остаётся', () => {
    renderSheet({ ...FIXTURE_SCHEMA_VIEW, guide: { ...FIXTURE_SCHEMA_GUIDE, coping: { ...FIXTURE_SCHEMA_GUIDE.coping, avoidance: '' } } });
    tab('Теория');
    expect(region('Копинг').getAllByRole('term').map((t) => t.textContent)).toEqual(['Капитуляция', 'Гиперкомпенсация']);
  });

  it('техника — кнопка в порядке вида; тап зовёт лист техники', () => {
    const { onOpenTechnique } = renderSheet();
    tab('На сессии');
    const session = region('На сессии');
    expect(session.getAllByRole('button').map((b) => b.textContent)).toEqual(['Работа со стульями', 'Рескриптинг образов']);
    fireEvent.click(session.getByRole('button', { name: 'Рескриптинг образов' }));
    expect(onOpenTechnique).toHaveBeenCalledWith('imagery_rescripting');
  });

  it('«Дать заданием» отдаёт пункт; без onAssign кнопок нет', () => {
    const onAssign = vi.fn();
    renderSheet(FIXTURE_SCHEMA_VIEW, onAssign);
    tab('Задания');
    fireEvent.click(region('Между сессиями').getByRole('button', { name: 'Дать заданием: Карточка схемы' }));
    expect(onAssign).toHaveBeenCalledWith(FIXTURE_SCHEMA_GUIDE.betweenSessions[0]);
  });

  it('без onAssign (справочник без клиента) — пункты есть, кнопок задания нет', () => {
    renderSheet();
    tab('Задания');
    expect(region('Между сессиями').getByText('Дневник разлук')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Дать заданием/ })).toBeNull();
  });
});

// «Про клиента» (#1484): из карточки клиента отмеченный стиль подсвечен его именем, тап — лист отметки.
describe('SchemaGuideSheet — «Про клиента» на стиле копинга', () => {
  it('отмеченный у клиента стиль — с его именем; кнопка стиля зовёт отметку', () => {
    const onMark = vi.fn();
    render(
      <MemoryRouter>
        <SchemaGuideSheet
          schemaName={NAME} view={FIXTURE_SCHEMA_VIEW} onOpenTechnique={() => {}} onClose={() => {}}
          coping={{ onMark, clientName: 'Анна', marked: (s) => s === 'surrender' }}
        />
      </MemoryRouter>,
    );
    tab('Теория');
    const coping = region('Копинг');
    expect(coping.getAllByRole('term')[0].textContent).toBe('Капитуляция · отмечено у Анна');
    expect(coping.getAllByRole('term')[1].textContent).not.toContain('отмечено');
    fireEvent.click(coping.getByRole('button', { name: 'Про клиента: Гиперкомпенсация' }));
    expect(onMark).toHaveBeenCalledWith('overcompensation');
  });
});
