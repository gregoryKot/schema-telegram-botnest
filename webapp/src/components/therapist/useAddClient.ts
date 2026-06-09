import { useRef, useState } from 'react';
import { api } from '../../api';
import type { TherapyClientSummary } from '../../api';

interface Params {
  setClients: React.Dispatch<React.SetStateAction<TherapyClientSummary[]>>;
}

export interface AddClientCreated {
  name: string;
  inviteUrl: string | null;
}

export function useAddClient({ setClients }: Params) {
  const [name, setName] = useState('');
  const [withInvite, setWithInvite] = useState(false);
  const [created, setCreated] = useState<AddClientCreated | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
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
    } catch (e: any) {
      setError(e?.message ?? 'Ошибка. Попробуй ещё раз.');
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setCreated(null);
    setCopied(false);
    setWithInvite(false);
    setError('');
    setTimeout(() => inputRef.current?.focus(), 30);
  }

  async function copyInvite() {
    if (!created?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(created.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* ignore */ }
  }

  return {
    name, setName,
    withInvite, setWithInvite,
    created, submitting, error, copied, valid,
    inputRef,
    submit, reset, copyInvite,
  };
}
