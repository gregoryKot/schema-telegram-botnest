import { TherapyService } from './therapy.service';

function makePrisma(overrides: Record<string, any> = {}) {
  return {
    therapyRelation: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    therapistNote: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 1, date: '2026-01-01', text: 'секрет' }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    modeMap: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
    },
    therapistCustomMode: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 1, name: 'X', nodeType: 'custom', emoji: '⬡' }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    ...overrides,
  } as any;
}

function makeService(prisma: any) {
  return new TherapyService(prisma, {} as any, {} as any);
}

describe('TherapyService — авторизация (assertRelation через assertHasClient)', () => {
  it('активная связь существует → проходит', async () => {
    const prisma = makePrisma();
    prisma.therapyRelation.findFirst.mockResolvedValue({ id: 1 });
    await expect(makeService(prisma).assertHasClient(10n, 5)).resolves.toBeUndefined();
    expect(prisma.therapyRelation.findFirst).toHaveBeenCalledWith({
      where: { therapistId: 10n, clientId: 5n, status: 'active' },
    });
  });

  it('нет активной связи → бросает (чужой клиент недоступен)', async () => {
    const prisma = makePrisma(); // findFirst → null
    await expect(makeService(prisma).assertHasClient(10n, 5)).rejects.toThrow('No active relation');
  });

  it('виртуальный клиент (clientId < 0) ищется по -id связи', async () => {
    const prisma = makePrisma();
    prisma.therapyRelation.findFirst.mockResolvedValue({ id: 7 });
    await makeService(prisma).assertHasClient(10n, -7);
    expect(prisma.therapyRelation.findFirst).toHaveBeenCalledWith({
      where: { id: 7, therapistId: 10n, status: 'active' },
    });
  });

  it('виртуальный клиент без связи → бросает', async () => {
    const prisma = makePrisma();
    await expect(makeService(prisma).assertHasClient(10n, -7)).rejects.toThrow('No active relation');
  });
});

describe('TherapyService — подключение', () => {
  it('createInvite генерирует уникальный код и url с startapp', async () => {
    const prisma = makePrisma();
    const { code, url } = await makeService(prisma).createInvite(10n);
    expect(code).toMatch(/^[0-9A-F]{12}$/);
    expect(url).toContain(`startapp=therapy_${code}`);
    expect(prisma.therapyRelation.create).toHaveBeenCalled();
  });

  it('joinAsClient: неизвестный код → false', async () => {
    const prisma = makePrisma();
    expect(await makeService(prisma).joinAsClient(5n, 'NOPE')).toBe(false);
  });

  it('joinAsClient: код не pending → false', async () => {
    const prisma = makePrisma();
    prisma.therapyRelation.findUnique.mockResolvedValue({ id: 1, status: 'active', clientId: null, therapistId: 10n });
    expect(await makeService(prisma).joinAsClient(5n, 'CODE')).toBe(false);
  });

  it('joinAsClient: код уже занят (clientId != null) → false', async () => {
    const prisma = makePrisma();
    prisma.therapyRelation.findUnique.mockResolvedValue({ id: 1, status: 'pending', clientId: 9n, therapistId: 10n });
    expect(await makeService(prisma).joinAsClient(5n, 'CODE')).toBe(false);
  });

  it('joinAsClient: попытка стать клиентом самого себя → false', async () => {
    const prisma = makePrisma();
    prisma.therapyRelation.findUnique.mockResolvedValue({ id: 1, status: 'pending', clientId: null, therapistId: 5n });
    expect(await makeService(prisma).joinAsClient(5n, 'CODE')).toBe(false);
  });

  it('joinAsClient: уже подключён к этому терапевту → true, без повторного update', async () => {
    const prisma = makePrisma();
    prisma.therapyRelation.findUnique.mockResolvedValue({ id: 1, status: 'pending', clientId: null, therapistId: 10n });
    prisma.therapyRelation.findFirst.mockResolvedValue({ id: 2 }); // уже active
    expect(await makeService(prisma).joinAsClient(5n, 'CODE')).toBe(true);
    expect(prisma.therapyRelation.update).not.toHaveBeenCalled();
  });

  it('joinAsClient: валидный код → активирует связь, true', async () => {
    const prisma = makePrisma();
    prisma.therapyRelation.findUnique.mockResolvedValue({ id: 1, status: 'pending', clientId: null, therapistId: 10n });
    expect(await makeService(prisma).joinAsClient(5n, 'code')).toBe(true);
    expect(prisma.therapyRelation.update).toHaveBeenCalledWith({
      where: { id: 1 }, data: { clientId: 5n, status: 'active' },
    });
  });
});

describe('TherapyService — заметки (гейтинг + scope)', () => {
  it('getNotes без связи → бросает (не отдаёт чужие заметки)', async () => {
    const prisma = makePrisma();
    await expect(makeService(prisma).getNotes(10n, 5)).rejects.toThrow('No active relation');
    expect(prisma.therapistNote.findMany).not.toHaveBeenCalled();
  });

  it('getNotes со связью → расшифровывает текст', async () => {
    const prisma = makePrisma();
    prisma.therapyRelation.findFirst.mockResolvedValue({ id: 1 });
    prisma.therapistNote.findMany.mockResolvedValue([{ id: 1, text: 'заметка' }]);
    const notes = await makeService(prisma).getNotes(10n, 5);
    expect(notes[0].text).toBe('заметка');
  });

  it('createNote без связи → бросает', async () => {
    const prisma = makePrisma();
    await expect(makeService(prisma).createNote(10n, 5, { date: '2026-01-01', text: 't' }))
      .rejects.toThrow('No active relation');
  });

  it('createNote со связью → сохраняет, возвращает плейнтекст', async () => {
    const prisma = makePrisma();
    prisma.therapyRelation.findFirst.mockResolvedValue({ id: 1 });
    const note = await makeService(prisma).createNote(10n, 5, { date: '2026-01-01', text: 'тело' });
    expect(note.text).toBe('тело');
    expect(prisma.therapistNote.create).toHaveBeenCalled();
  });

  it('deleteNote ограничен по therapistId (нельзя удалить чужую)', async () => {
    const prisma = makePrisma();
    await makeService(prisma).deleteNote(10n, 99);
    expect(prisma.therapistNote.deleteMany).toHaveBeenCalledWith({ where: { id: 99, therapistId: 10n } });
  });
});

describe('TherapyService — карты режимов (проверка владельца)', () => {
  it('getModeMap чужого терапевта → Not found', async () => {
    const prisma = makePrisma();
    prisma.modeMap.findUnique.mockResolvedValue({ id: 1, therapistId: 999n, title: 'enc' });
    await expect(makeService(prisma).getModeMap(10n, 1)).rejects.toThrow('Not found');
  });

  it('getModeMap несуществующей → Not found', async () => {
    const prisma = makePrisma();
    prisma.modeMap.findUnique.mockResolvedValue(null);
    await expect(makeService(prisma).getModeMap(10n, 1)).rejects.toThrow('Not found');
  });

  it('getModeMap своей карты → возвращает расшифрованную', async () => {
    const prisma = makePrisma();
    prisma.modeMap.findUnique.mockResolvedValue({ id: 1, therapistId: 10n, title: 'Карта', nodes: [], edges: [] });
    expect((await makeService(prisma).getModeMap(10n, 1)).title).toBe('Карта');
  });

  it('updateModeMap чужой карты → Not found (не апдейтит)', async () => {
    const prisma = makePrisma();
    prisma.modeMap.findUnique.mockResolvedValue({ id: 1, therapistId: 999n });
    await expect(makeService(prisma).updateModeMap(10n, 1, { title: 'x' })).rejects.toThrow('Not found');
    expect(prisma.modeMap.update).not.toHaveBeenCalled();
  });

  it('deleteModeMap чужой карты → Not found (не удаляет)', async () => {
    const prisma = makePrisma();
    prisma.modeMap.findUnique.mockResolvedValue({ id: 1, therapistId: 999n });
    await expect(makeService(prisma).deleteModeMap(10n, 1)).rejects.toThrow('Not found');
    expect(prisma.modeMap.delete).not.toHaveBeenCalled();
  });

  it('getMyModeMap: клиент видит только свою карту', async () => {
    const prisma = makePrisma();
    prisma.modeMap.findUnique.mockResolvedValue({ id: 1, clientId: 999n });
    await expect(makeService(prisma).getMyModeMap(5n, 1)).rejects.toThrow('Not found');
  });

  it('createModeMap: неизвестный kind → fallback на "problem"', async () => {
    const prisma = makePrisma();
    prisma.therapyRelation.findFirst.mockResolvedValue({ id: 1 });
    prisma.modeMap.create.mockResolvedValue({ id: 1, title: 'enc', kind: 'problem' });
    await makeService(prisma).createModeMap(10n, 5, 'T', 'invalid-kind');
    expect(prisma.modeMap.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ kind: 'problem' }),
    }));
  });
});

describe('TherapyService — кастомные режимы', () => {
  it('createCustomMode: неизвестный nodeType → "custom", emoji обрезан', async () => {
    const prisma = makePrisma();
    await makeService(prisma).createCustomMode(10n, { name: 'Режим', nodeType: 'hacker', emoji: '🚀🚀🚀🚀🚀' });
    const data = prisma.therapistCustomMode.create.mock.calls[0][0].data;
    expect(data.nodeType).toBe('custom');
    expect(data.emoji.length).toBeLessThanOrEqual(8);
  });

  it('createCustomMode: валидный nodeType сохраняется', async () => {
    const prisma = makePrisma();
    await makeService(prisma).createCustomMode(10n, { name: 'Режим', nodeType: 'critic' });
    expect(prisma.therapistCustomMode.create.mock.calls[0][0].data.nodeType).toBe('critic');
  });

  it('deleteCustomMode ограничен по therapistId', async () => {
    const prisma = makePrisma();
    await makeService(prisma).deleteCustomMode(10n, 3);
    expect(prisma.therapistCustomMode.deleteMany).toHaveBeenCalledWith({ where: { id: 3, therapistId: 10n } });
  });
});
