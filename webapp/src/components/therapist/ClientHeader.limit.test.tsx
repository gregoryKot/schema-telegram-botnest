// @vitest-environment jsdom
// Поле переименования клиента в шапке кабинета: сервер принимает псевдоним не
// длиннее CLIENT_NAME_MAX (`RenameClientDto.alias`), поле не пускает больше.
// Раньше предела не было ни там, ни там — только в мини-аппе стояло
// `maxLength={100}` литералом.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ClientHeader } from './ClientHeader';
import type { ClientDetail } from './clientSheetTypes';
import type { TherapyClientSummary } from '../../api';
import { CLIENT_NAME_MAX } from '../../../../shared/src/limits/textLimits';

afterEach(() => {
  cleanup();
});

describe('ClientHeader — предел длины псевдонима', () => {
  it('поле переименования не принимает больше CLIENT_NAME_MAX знаков', () => {
    const detail = {
      clientSchemaNotesData: [],
      clientModeNotesData: [],
      clientTasks: [],
      notes: [],
      clientData: null,
      clientDiary: [],
      setShowAssign: vi.fn(),
      renamingAlias: true,
      setRenamingAlias: vi.fn(),
      aliasInput: 'Анна',
      setAliasInput: vi.fn(),
      aliasSaving: false,
      aliasError: '',
      deleteClient: vi.fn(),
      requestDeleteClient: vi.fn(),
      cancelDeleteClient: vi.fn(),
      confirmingDelete: false,
      deleteLoading: false,
      deleteError: '',
      clientTab: 'overview',
      setClientTab: vi.fn(),
      saveAlias: vi.fn(),
    } as unknown as ClientDetail;
    const client = {
      telegramId: 1,
      name: 'Анна',
      clientAlias: null,
    } as unknown as TherapyClientSummary;
    render(
      <MemoryRouter>
        <ClientHeader selectedClient={client} detail={detail} switchView={vi.fn()} />
      </MemoryRouter>,
    );
    const input = screen.getByDisplayValue('Анна') as HTMLInputElement;
    expect(input.maxLength).toBe(CLIENT_NAME_MAX);
  });
});
