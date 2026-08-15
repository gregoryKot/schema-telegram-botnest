import { useRef, useState } from 'react';
import { useTr } from '../../utils/addressForm';
import { api } from '../../api';
import { useCopyToClipboard } from '../../../../shared/src/utils/useCopyToClipboard';
import type { TherapyClientSummary } from '../../api';

export type AddMode = null | 'invite' | 'telegram' | 'virtual';

interface Params {
  setClients: React.Dispatch<React.SetStateAction<TherapyClientSummary[]>>;
}

export function useAddClient({ setClients }: Params) {
  const tr = useTr();
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [addInput, setAddInput] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const inviteInputRef = useRef<HTMLInputElement>(null);
  const {
    copied: inviteCopied,
    failed: inviteCopyFailed,
    copy: doCopyInvite,
  } = useCopyToClipboard();

  function openAddMode(mode: AddMode) {
    setAddMode(mode);
    setAddInput('');
    setAddError('');
    setInviteUrl('');
  }

  async function createInvite() {
    setInviteLoading(true);
    try {
      const { url } = await api.createTherapyInvite();
      setInviteUrl(url);
    } catch {
      setAddError('Не удалось создать ссылку');
    } finally {
      setInviteLoading(false);
    }
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    // Буфер недоступен — код и так на экране в поле, выделяем для ручного копирования.
    const ok = await doCopyInvite(inviteUrl);
    if (!ok) inviteInputRef.current?.select();
  }

  async function addByTelegramId() {
    const id = parseInt(addInput.trim(), 10);
    if (!id || isNaN(id)) {
      setAddError(tr('Введи числовой Telegram ID', 'Введите числовой Telegram ID'));
      return;
    }
    setAddLoading(true);
    setAddError('');
    try {
      const updated = await api.addClientManually(id);
      setClients(updated);
      openAddMode(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.toLowerCase().includes('not found'))
        setAddError('Пользователь не найден. Должен открыть приложение хотя бы раз.');
      else if (msg.toLowerCase().includes('already'))
        setAddError('Клиент уже подключён');
      else
        setAddError(
          tr('Не нашёлся клиент с таким ID. Проверь код и попробуй ещё раз.', 'Не нашёлся клиент с таким ID. Проверьте код и попробуйте ещё раз.'),
        );
    } finally {
      setAddLoading(false);
    }
  }

  async function addVirtualClient() {
    const name = addInput.trim();
    if (!name) {
      setAddError(tr('Введи имя клиента', 'Введите имя клиента'));
      return;
    }
    setAddLoading(true);
    setAddError('');
    try {
      const updated = await api.addVirtualClient(name);
      setClients(updated);
      openAddMode(null);
    } catch {
      setAddError(
        tr('Ошибка. Попробуй ещё раз.', 'Ошибка. Попробуйте ещё раз.'),
      );
    } finally {
      setAddLoading(false);
    }
  }

  return {
    addMode,
    setAddMode,
    addInput,
    setAddInput,
    addLoading,
    addError,
    setAddError,
    inviteUrl,
    setInviteUrl,
    inviteCopied,
    inviteCopyFailed,
    inviteLoading,
    inviteInputRef,
    openAddMode,
    createInvite,
    copyInvite,
    addByTelegramId,
    addVirtualClient,
  };
}
