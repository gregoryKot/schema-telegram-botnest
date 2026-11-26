// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { listAddresses } from '../../../../../../shared/src/schemaTherapy/guide';
import type { GuideMark } from '../../../../../../shared/src/therapy/guideMarks/guideMarksApi';
import { GuideMarksBlock } from './GuideMarksBlock';

vi.mock('./GuideForClientSheet', () => ({
  GuideForClientSheet: ({ client, address, onClose }: { client: { name: string }; address?: string; onClose: () => void }) => (
    <div role="dialog">{client.name}|{address ?? 'всё'}<button onClick={onClose}>закрыть</button></div>
  ),
}));

const mark = (id: number, address: string): GuideMark => ({
  id, clientId: '11', address, note: null, snapshot: 'Сохранённый текст', createdAt: '', updatedAt: '',
});
const LIVE = listAddresses('mode').find((a) => a.endsWith('/goal'))!;
const client = { id: '11' as never, name: 'Аня' };

describe('справочник из карточки клиента', () => {
  it('«Добавить из справочника» открывает его с клиентом, закрытие перечитывает отметки', () => {
    const onReload = vi.fn();
    render(<GuideMarksBlock marks={[]} conceptEmpty={false} onRemove={() => {}} client={client} onReload={onReload} />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить из справочника' }));
    expect(screen.getByRole('dialog').textContent).toContain('Аня|всё');
    fireEvent.click(screen.getByText('закрыть'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onReload).toHaveBeenCalledOnce();
  });

  it('«Открыть в справочнике» ведёт на раздел отметки; исчезнувший раздел — спокойный текст, без кнопки', async () => {
    render(<GuideMarksBlock marks={[mark(1, LIVE), mark(2, 'schema:subjugation/noSuchField')]} conceptEmpty={false} onRemove={() => {}} client={client} />);
    const open = await screen.findAllByRole('button', { name: 'Открыть в справочнике' });
    expect(open).toHaveLength(1);
    expect(screen.getByText('раздела в справочнике больше нет')).toBeTruthy();
    fireEvent.click(open[0]);
    expect(screen.getByRole('dialog').textContent).toContain(`Аня|${LIVE}`);
  });
});
