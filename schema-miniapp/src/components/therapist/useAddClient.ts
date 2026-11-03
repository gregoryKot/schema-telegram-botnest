import { useRef, useState } from 'react';
import { useTr } from '../../utils/addressForm';
import { api, type TherapyClientSummary } from '../../api';
import { useCopyToClipboard } from '../../../../shared/src/utils/useCopyToClipboard';
import { useSingleFlight } from '../../../../shared/src/utils/useSingleFlight';
import {
  inviteCreateErrorText,
  usePendingInvites,
} from '../../../../shared/src/therapy/therapyInvites';

export type AddMode = null | 'invite' | 'virtual';
type Invite = { url: string; code: string };

interface Params {
  setClients: React.Dispatch<React.SetStateAction<TherapyClientSummary[]>>;
}

// Добавление клиента в кабинете мини-аппа: «Ссылка» — приглашение (имя
// необязательно: с ним человек виден в «Ждут подключения», а после
// подключения карточка называется так), «Оффлайн» — карточка без аккаунта.
// Инцидент 2026-10-26: «Создать новую» отдавало тот же код — второй клиент
// получал ссылку первого; теперь у приглашения свой код, `pending` перечитан.
// QA 2026-11: создание под useSingleFlight — двойной тап не даёт двух клиентов.
// Пара на сайте — webapp/src/components/therapist/useAddClient.ts.
export function useAddClient({ setClients }: Params) {
  const tr = useTr();
  const once = useSingleFlight();
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [addInput, setAddInput] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [invite, setInvite] = useState<Invite | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const inviteInputRef = useRef<HTMLInputElement>(null);
  const pending = usePendingInvites(api);
  const {
    copied: inviteCopied,
    failed: inviteCopyFailed,
    copy: doCopyInvite,
  } = useCopyToClipboard();

  function openAddMode(mode: AddMode) {
    setAddMode(mode);
    setAddInput('');
    setAddError('');
    setInvite(null);
  }

  async function createInvite() {
    setInviteLoading(true);
    setAddError('');
    try {
      setInvite(await api.createTherapyInvite(addInput.trim() || undefined));
      setAddInput('');
      pending.reload();
    } catch (e) {
      setAddError(inviteCreateErrorText(e, tr));
    } finally {
      setInviteLoading(false);
    }
  }

  async function copyInvite() {
    if (!invite) return;
    // Буфер недоступен — ссылка и так на экране в поле, выделяем для ручного копирования.
    const ok = await doCopyInvite(invite.url);
    if (!ok) inviteInputRef.current?.select();
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
    invite,
    setInvite,
    inviteCopied,
    inviteCopyFailed,
    inviteLoading,
    inviteInputRef,
    pending,
    openAddMode,
    createInvite: once(createInvite),
    copyInvite,
    addVirtualClient: once(addVirtualClient),
  };
}
