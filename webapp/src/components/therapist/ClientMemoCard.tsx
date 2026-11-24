import { useState, type CSSProperties } from 'react';
import { api, type TherapyClientSummary } from '../../api';
import { useTr } from '../../utils/addressForm';
import { detectCrisisAny } from '../../utils/crisisMarkers';
import { CrisisCard } from '../CrisisCard';
import { LimitedTextarea } from '../../../../shared/src/components/LimitedTextarea';
import { CLIENT_MEMO_MAX } from '../../../../shared/src/limits/textLimits';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { SignHead } from './SignArt';
import type { ClientDetail } from './clientSheetTypes';

interface Props {
  client: TherapyClientSummary;
  detail: Pick<ClientDetail, 'saveSessionInfo'>;
}

/** «О клиенте»: одна свободная заметка терапевта, клиент её не видит. Пустой текст при сохранении стирает заметку. */
export function ClientMemoCard({ client, detail }: Props) {
  const tr = useTr();
  const [stored, setStored] = useState(client.memo ?? '');
  const [text, setText] = useState(stored);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState(false);
  const dirty = text.trim() !== stored;

  async function save() {
    const memo = text.trim() || null;
    setBusy(true);
    setFailed(false);
    const ok = await detail.saveSessionInfo({ memo });
    setBusy(false);
    setFailed(!ok);
    setDone(ok);
    if (!ok) return;
    setText(memo ?? '');
    setStored(memo ?? '');
    api.trackEvent('cabinet_client_memo_saved', { length: memo?.length ?? 0, cleared: memo === null });
  }

  return (
    <section className="pp-leaf tk-leaf" style={{ '--h': ENTITY_LOOK.note.hue } as CSSProperties}>
      <SignHead kind="pebbles" className="ds-label">О клиенте</SignHead>
      <p className="ds-sub">{tr('Любой текст о клиенте. Видишь только ты.', 'Любой текст о клиенте. Видите только вы.')}</p>
      <LimitedTextarea
        max={CLIENT_MEMO_MAX} className="ds-textarea" rows={4} value={text}
        aria-label="О клиенте" onChange={(e) => { setText(e.target.value); setDone(false); }}
      />
      {detectCrisisAny(text) && <CrisisCard surface="note" compact />}
      <div className="gd-acts">
        <button type="button" className="ds-btn" disabled={!dirty || busy} aria-busy={busy || undefined} onClick={() => void save()}>Сохранить заметку</button>
        {done && !dirty && <span className="ds-sub" role="status">Сохранено</span>}
        {failed && <span className="tb-error" role="alert">{tr('Не удалось сохранить. Текст остался в поле, попробуй ещё раз.', 'Не удалось сохранить. Текст остался в поле, попробуйте ещё раз.')}</span>}
      </div>
    </section>
  );
}
