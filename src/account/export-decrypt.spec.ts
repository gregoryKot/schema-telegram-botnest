// Аудит 2026-10, D-8: нечитаемый список приходит из decryptRecord пустым `[]`.
// В выгрузке «все мои данные» это выглядело бы как «ничего не было» — человек
// получил бы тихо неполную копию. Рядом с таким полем лежит пометка.
process.env.ENCRYPTION_KEY = 'ab'.repeat(32);

import { Logger } from '@nestjs/common';
import { encrypt, encryptJson } from '../utils/crypto';
import { decryptExport } from './export-decrypt';

const foreign = Buffer.alloc(48, 7).toString('base64');
const schema = { strings: ['text'], jsonArrays: ['items'] };

describe('decryptExport', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('читаемая строка — без пометки, поля расшифрованы', () => {
    const row = { id: 1, text: encrypt('заметка'), items: encryptJson(['a']) };
    expect(decryptExport(row, schema)).toEqual({
      id: 1,
      text: 'заметка',
      items: ['a'],
    });
  });

  it('нечитаемые поля названы в _unreadableFields, список пуст, а не строка', () => {
    const out = decryptExport({ id: 2, text: foreign, items: foreign }, schema);
    expect(out.items).toEqual([]);
    expect(out._unreadableFields).toEqual(['text', 'items']);
  });

  it('пометка попадает в JSON выгрузки', () => {
    const out = decryptExport({ id: 3, items: foreign }, schema);
    expect(JSON.parse(JSON.stringify(out))).toEqual({
      id: 3,
      items: [],
      _unreadableFields: ['items'],
    });
  });
});
