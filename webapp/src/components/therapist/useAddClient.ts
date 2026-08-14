import { useRef, useState } from 'react';
import { api } from '../../api';
import { useTr } from '../../utils/addressForm';
import { useCopyToClipboard } from '../../../../shared/src/utils/useCopyToClipboard';
import type { TherapyClientSummary } from '../../api';

interface Params {
  setClients: React.Dispatch<React.SetStateAction<TherapyClientSummary[]>>;
}

export interface AddClientCreated {
  name: string;
  inviteUrl: string | null;
}

export function useAddClient({ setClients }: Params) {
  const tr = useTr();
  const [name, setName] = useState('');
  const [withInvite, setWithInvite] = useState(false);
  const [created, setCreated] = useState<AddClientCreated | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { copied, failed: copyFailed, copy } = useCopyToClipboard();
  const inputRef = useRef<HTMLInputElement>(null);

  const valid = name.trim().length >= 2;

  async function submit() {
    if (!valid) { inputRef.current?.focus(); return; }
    const trimmed = name.trim();
    setSubmitting(true);
    setError('');
    try {
      const updated = await api.addVirtualClient(trimmed);
      setClients(updated);
      let inviteUrl: string | null = null;
      if (withInvite) {
        const { url } = await api.createTherapyInvite();
        inviteUrl = url;
      }
      setCreated({ name: trimmed, inviteUrl });
      setName('');
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : tr('Ошибка. Попробуй ещё раз.', 'Ошибка. Попробуйте ещё раз.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setCreated(null);
    setWithInvite(false);
    setError('');
    setTimeout(() => inputRef.current?.focus(), 30);
  }

  async function copyInvite() {
    if (!created?.inviteUrl) return;
    await copy(created.inviteUrl);
  }

  return {
    name, setName,
    withInvite, setWithInvite,
    created, submitting, error, copied, copyFailed, valid,
    inputRef,
    submit, reset, copyInvite,
  };
}
