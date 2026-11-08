import { useRef, useState } from 'react';
import { api, reportClientError, type TherapyClientSummary } from '../../api';
import { useTr } from '../../utils/addressForm';
import { useCopyToClipboard } from '../../../../shared/src/utils/useCopyToClipboard';
import { useSingleFlight } from '../../../../shared/src/utils/useSingleFlight';
import { inviteCreateErrorText, usePendingInvites } from '../../../../shared/src/therapy/therapyInvites';
import { useCardClaims } from '../../../../shared/src/therapy/cardClaims';

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
// клиента); с галочкой — только приглашение с этим именем (раньше галочка
// давала обе, и после подключения было две карточки одного человека). До
// подключения приглашённый виден в «Ждут подключения» (`pending`); код из
// офлайн-карточки ждёт сверки (`claims`, S8: «Да» перечитывает список клиентов).
// QA 2026-11: двойной Enter — submit под useSingleFlight; «Добавить ещё» — `open` здесь.
export function useAddClient({ setClients }: Params) {
  const tr = useTr();
  const once = useSingleFlight();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [withInvite, setWithInvite] = useState(false);
  const [created, setCreated] = useState<AddClientCreated | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { copied, failed: copyFailed, copy } = useCopyToClipboard();
  const inputRef = useRef<HTMLInputElement>(null);
  const pending = usePendingInvites(api);
  const claims = useCardClaims(api, () => void api.getTherapyClients().then(setClients)
    .catch(() => reportClientError({ message: 'therapy clients reload failed', section: 'therapist.clients' })));

  const valid = name.trim().length >= 2;

  async function submit() {
    if (!valid) { inputRef.current?.focus(); return; }
    const trimmed = name.trim();
    setSubmitting(true); setError('');
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

  function reset(keepOpen = true) { // «Добавить ещё» — форма открыта, «к списку» (close) — свёрнута
    setCreated(null); setWithInvite(false); setError(''); setOpen(keepOpen);
    if (keepOpen) setTimeout(() => inputRef.current?.focus(), 30);
  }

  async function copyInvite() {
    if (!created?.invite) return;
    await copy(created.invite.url);
  }

  return {
    name, setName, withInvite, setWithInvite, open, setOpen,
    created, submitting, error, copied, copyFailed, valid,
    inputRef, pending, claims,
    submit: () => once(submit), reset: () => reset(), close: () => reset(false), copyInvite,
  };
}
