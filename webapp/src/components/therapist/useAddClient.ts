import { useRef, useState } from 'react';
import { api } from '../../api';
import type { TherapyClientSummary } from '../../api';

type AddMode = null | 'invite' | 'telegram' | 'virtual';

interface Params {
  setClients: React.Dispatch<React.SetStateAction<TherapyClientSummary[]>>;
}

export function useAddClient({ setClients }: Params) {
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [addInput, setAddInput] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const inviteInputRef = useRef<HTMLInputElement>(null);

  function openAddMode(mode: AddMode) {
    setAddMode(mode);
    setAddInput('');
    setAddError('');
    setInviteUrl('');
    setInviteCopied(false);
  }

  async function createInvite() {
    setInviteLoading(true);
    try {
      const { url } = await api.createTherapyInvite();
      setInviteUrl(url);
    } catch (e: any) {
      setAddError(e?.message ?? 'Не удалось создать ссылку');
    } finally { setInviteLoading(false); }
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch { inviteInputRef.current?.select(); }
  }

  function shareInvite() {
    if (!inviteUrl) return;
    if (navigator.share) {
      navigator.share({ text: 'Подключись ко мне в Схема-лабе:', url: inviteUrl }).catch(() => {});
    } else {
      const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent('Подключись ко мне в Схема-лабе')}`;
      window.open(tgUrl, '_blank', 'noopener');
    }
  }

  async function addByTelegramId() {
    const id = parseInt(addInput.trim(), 10);
    if (!id || isNaN(id)) { setAddError('Введи числовой Telegram ID'); return; }
    setAddLoading(true);
    setAddError('');
    try {
      const updated = await api.addClientManually(id);
      setClients(updated);
      openAddMode(null);
    } catch (e: any) {
      const msg = e?.message ?? '';
      if (msg.toLowerCase().includes('not found'))
        setAddError('Пользователь не найден. Должен открыть приложение хотя бы раз.');
      else if (msg.toLowerCase().includes('already'))
        setAddError('Клиент уже подключён');
      else
        setAddError('Ошибка. Проверь ID.');
    } finally { setAddLoading(false); }
  }

  async function addVirtualClient() {
    const name = addInput.trim();
    if (!name) { setAddError('Введи имя клиента'); return; }
    setAddLoading(true);
    setAddError('');
    try {
      const updated = await api.addVirtualClient(name);
      setClients(updated);
      openAddMode(null);
    } catch { setAddError('Ошибка. Попробуй ещё раз.'); } finally { setAddLoading(false); }
  }

  return {
    addMode, addInput, setAddInput,
    addLoading, addError,
    inviteUrl, inviteCopied, inviteLoading, inviteInputRef,
    openAddMode, createInvite, copyInvite, shareInvite,
    addByTelegramId, addVirtualClient,
  };
}
