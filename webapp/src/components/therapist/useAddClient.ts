import { useRef, useState } from 'react';
import { api } from '../../api';
import { useTr } from '../../utils/addressForm';
import { useCopyToClipboard } from '../../../../shared/src/utils/useCopyToClipboard';
import { inviteCreateErrorText, usePendingInvites } from '../../../../shared/src/therapy/therapyInvites';
import type { TherapyClientSummary } from '../../api';

interface Params {
  setClients: React.Dispatch<React.SetStateAction<TherapyClientSummary[]>>;
}

export interface AddClientCreated {
  name: string;
  /** Есть — создано приглашение (карточка появится после подключения). */
  invite: { url: string; code: string } | null;
}

// «+ Новый клиент» в кабинете. Две разные вещи, а не одна с довеском
// (инцидент 2026-10-26): без галочки — офлайн-карточка (записи без аккаунта
// клиента); с галочкой — только приглашение с этим именем. Раньше галочка
// создавала И офлайн-карточку, И независимое приглашение, и после подключения
// в списке было две карточки одного человека. Данные офлайн-карточки висят на
// -TherapyRelation.id и в связь с аккаунтом не переезжают, поэтому карточка
// для приглашённого — та, что появится после подключения, с именем отсюда; до
// подключения он виден в блоке «Ждут подключения» (`pending`).
export function useAddClient({ setClients }: Params) {
  const tr = useTr();
  const [name, setName] = useState('');
  const [withInvite, setWithInvite] = useState(false);
  const [created, setCreated] = useState<AddClientCreated | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { copied, failed: copyFailed, copy } = useCopyToClipboard();
  const inputRef = useRef<HTMLInputElement>(null);
  const pending = usePendingInvites(api);

  const valid = name.trim().length >= 2;

  async function submit() {
    if (!valid) { inputRef.current?.focus(); return; }
    const trimmed = name.trim();
    setSubmitting(true);
    setError('');
    try {
      if (withInvite) {
        const invite = await api.createTherapyInvite(trimmed);
        pending.reload();
        setCreated({ name: trimmed, invite });
      } else {
        setClients(await api.addVirtualClient(trimmed));
        setCreated({ name: trimmed, invite: null });
      }
      setName('');
    } catch (e: unknown) {
      setError(
        withInvite
          ? inviteCreateErrorText(e, tr)
          : e instanceof Error
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
    if (!created?.invite) return;
    await copy(created.invite.url);
  }

  return {
    name, setName,
    withInvite, setWithInvite,
    created, submitting, error, copied, copyFailed, valid,
    inputRef, pending,
    submit, reset, copyInvite,
  };
}
