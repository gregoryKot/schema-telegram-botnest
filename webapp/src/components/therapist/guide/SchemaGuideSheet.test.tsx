// @vitest-environment jsdom
// Лист схемы (#995): разделы справочника по порядку, пустые не рисуются,
// типичные режимы — названиями из реестра (id без режима пропускается), фраза
// репарентинга — репликой в кавычках и курсивом, техника ведёт в лист техники,
// «Дать заданием» отдаёт пункт. Содержание — фикстура, не тексты
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
  it('разделы справочника по порядку, с «общим для домена»', () => {
    renderSheet(FIXTURE_SCHEMA_VIEW, vi.fn());
    expect(screen.getByRole('dialog', { name: NAME })).toBeTruthy();
    expect(regions()).toEqual([
      'Суть', 'Потребность', 'Копинг', 'Типичные режимы', 'Общее для домена', 'В кабинете',
      'Фраза репарентинга', 'Интервенции', 'На сессии', 'Между сессиями', 'Где застревают', 'Источники',
    ]);
    expect(region('Общее для домена').getByText(FIXTURE_DOMAIN_NOTE)).toBeTruthy();
    expect(region('Суть').getByText(FIXTURE_SCHEMA_GUIDE.essence)).toBeTruthy();
    expect(screen.getByText(FIXTURE_SCHEMA_GUIDE.sources)).toBeTruthy();
  });

  it('копинг — три стиля подписью и строкой', () => {
    renderSheet();
    const coping = region('Копинг');
    expect(coping.getAllByRole('term').map((t) => t.textContent)).toEqual(['Капитуляция', 'Избегание', 'Гиперкомпенсация']);
    expect(coping.getByText(FIXTURE_SCHEMA_GUIDE.coping.avoidance)).toBeTruthy();
  });

  it('типичные режимы — названиями из реестра, неизвестный id пропущен', () => {
    renderSheet();
    expect(region('Типичные режимы').getByText('Покинутый Ребёнок, Сердитый Ребёнок')).toBeTruthy();
    expect(screen.queryByText(/abandoned_child|нет_такого_режима/)).toBeNull();
  });

  it('фраза репарентинга — реплика: кавычки и курсив ставит лист', () => {
    renderSheet();
    const quote = region('Фраза репарентинга').getByText(`«${FIXTURE_SCHEMA_GUIDE.reparenting}»`);
    expect(quote.tagName).toBe('BLOCKQUOTE');
    expect(quote.style.fontStyle).toBe('italic');
  });

  it('интервенции — список пунктов', () => {
    renderSheet();
    const items = region('Интервенции').getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual(FIXTURE_SCHEMA_GUIDE.interventions);
  });

  it('пустое не показывается: без копинга, режимов, домена, репарентинга, интервенций и «Где застревают»', () => {
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
    expect(regions()).toEqual(['Суть', 'Потребность', 'На сессии', 'Между сессиями', 'Источники']);
    expect(screen.queryByText('«»')).toBeNull();
  });

  it('один стиль копинга пуст — его строки нет, раздел остаётся', () => {
    renderSheet({ ...FIXTURE_SCHEMA_VIEW, guide: { ...FIXTURE_SCHEMA_GUIDE, coping: { ...FIXTURE_SCHEMA_GUIDE.coping, avoidance: '' } } });
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
