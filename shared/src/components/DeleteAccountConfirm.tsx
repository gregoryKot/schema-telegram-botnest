// Финальный шаг удаления аккаунта — один на сайт и мини-апп (правило №3 и
// «одна механика — один компонент»): «Точно?» + кнопка, а если у аккаунта
// включена двухфакторная защита (сервер ответил 403 totp_required) — поле кода
// и повтор запроса уже с ним (B-13 аудита 2026-10).
//
// Побочное (чистка локального хранилища, перезагрузка) остаётся за экраном:
// у сайта и мини-аппа оно разное (`onDeleted`). Состояние «идёт удаление»
// держит родитель (`deleting`/`setDeleting`) — оно у него и раньше жило.
import { useState } from 'react';
import {
  attemptDeleteAccount,
  buildDeleteTotpText,
} from '../account/deleteAccountTotp';
import type { Tr } from '../account/accountLinkText';

interface Props {
  tr: Tr;
  deleting: boolean;
  setDeleting: (v: boolean) => void;
  /** api.deleteAllUserData: код — только если сервер его потребовал. */
  deleteAllUserData: (code?: string) => Promise<void>;
  /** Аккаунт удалён: почистить хранилище и перезагрузить. */
  onDeleted: () => void;
  /** Сбой не из-за кода (сеть, 5xx): экран сам решает, что показать. */
  onFailed: () => void;
}

export function DeleteAccountConfirm({
  tr,
  deleting,
  setDeleting,
  deleteAllUserData,
  onDeleted,
  onFailed,
}: Props) {
  const [needCode, setNeedCode] = useState(false);
  const [code, setCode] = useState('');
  const [rejected, setRejected] = useState(false);
  const copy = buildDeleteTotpText(tr);

  const submit = async () => {
    setDeleting(true);
    setRejected(false);
    const outcome = await attemptDeleteAccount(deleteAllUserData, code);
    if (outcome === 'deleted') return onDeleted();
    setDeleting(false);
    if (outcome === 'need_code') setNeedCode(true);
    else if (outcome === 'wrong_code') setRejected(true);
    else onFailed();
  };

  return (
    <div>
      <div
        style={{
          fontSize: 14,
          color: 'var(--accent-red)',
          textAlign: 'center',
          marginBottom: 16,
          fontWeight: 500,
        }}
      >
        Точно? Восстановить невозможно.
      </div>
      {needCode && (
        <div style={{ marginBottom: 14 }}>
          <label
            htmlFor="delete-account-code"
            style={{
              display: 'block',
              fontSize: 13,
              lineHeight: 1.5,
              color: 'var(--text-sub)',
              marginBottom: 8,
            }}
          >
            {copy.label}
          </label>
          <input
            id="delete-account-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            placeholder={copy.placeholder}
            style={{
              width: '100%',
              minHeight: 44,
              padding: '0 14px',
              boxSizing: 'border-box',
              borderRadius: 'var(--r-12)',
              border: '1px solid rgba(var(--fg-rgb),0.15)',
              background: 'transparent',
              color: 'var(--text)',
              fontSize: 16,
              fontFamily: 'inherit',
            }}
          />
          {rejected && (
            <div
              role="alert"
              style={{ fontSize: 12, color: 'var(--accent-red)', marginTop: 8 }}
            >
              {copy.wrong}
            </div>
          )}
        </div>
      )}
      <button
        disabled={deleting || (needCode && code.trim().length < 6)}
        onClick={() => void submit()}
        style={{
          width: '100%',
          minHeight: 44,
          padding: '13px 0',
          borderRadius: 'var(--r-12)',
          border: 'none',
          background: 'var(--accent-red)',
          color: 'var(--on-accent-red)',
          fontSize: 15,
          fontWeight: 600,
          cursor: deleting ? 'default' : 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {deleting ? 'Удаляем...' : 'Да, удалить всё навсегда'}
      </button>
    </div>
  );
}
