// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { listAddresses } from '../../../../../../shared/src/schemaTherapy/guide';
import type { GuideMark } from '../../../../../../shared/src/therapy/guideMarks/guideMarksApi';
import { GuideMarksBlock } from './GuideMarksBlock';

const mark = (id: number, address: string, note: string | null = null): GuideMark => ({
  id, clientId: '11', address, note, snapshot: 'Сохранённый текст раздела', createdAt: '', updatedAt: '',
});
const LIVE = listAddresses('mode').find((a) => a.endsWith('/goal'))!;

describe('блок «Из справочника» в карточке клиента', () => {
  it('отметок нет — блока нет; в пустой схеме случая — строка, откуда он берётся', () => {
    const { container, rerender } = render(<GuideMarksBlock marks={[]} conceptEmpty={false} onRemove={() => {}} />);
    expect(container.textContent).toBe('');
    rerender(<GuideMarksBlock marks={[]} conceptEmpty onRemove={() => {}} />);
    expect(screen.getByText(/в Справочнике «Про клиента» — это появится здесь/)).toBeTruthy();
    rerender(<GuideMarksBlock marks={null} conceptEmpty onRemove={() => {}} />);
    expect(container.textContent).toBe('');
  });

  it('пока грузится — скелетон, а не пустота', () => {
    render(<GuideMarksBlock marks={undefined} conceptEmpty={false} onRemove={() => {}} />);
    expect(screen.getByRole('region', { name: 'Из справочника' }).getAttribute('aria-busy')).toBe('true');
  });

  it('запись — заголовок раздела и заметка; исчезнувший раздел — сохранённый текст с пометкой; крестик снимает', async () => {
    const onRemove = vi.fn();
    const gone = mark(2, 'schema:subjugation/noSuchField');
    render(<GuideMarksBlock marks={[mark(1, LIVE, 'про маму'), gone]} conceptEmpty={false} onRemove={onRemove} />);
    expect(await screen.findByText(/что вы отметили «Про клиента»|что ты отмечаешь «Про клиента»/)).toBeTruthy();
    expect(screen.getByText(/· Цель$/)).toBeTruthy();
    expect(screen.getByText('про маму')).toBeTruthy();
    expect(screen.getAllByText('раздел изменился')).toHaveLength(1);
    expect(screen.getByText('Сохранённый текст раздела')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /^Снять отметку/ })[1]);
    expect(onRemove).toHaveBeenCalledWith(gone);
  });
});
