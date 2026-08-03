import { useState } from 'react';
import { api } from '../../api';

// Подтверждение удаления аккаунта. Вынесено из ProfileSection (файл-должник
// сверх 300 строк — правило №10 CLAUDE.md: он обязан таять, а не пухнуть) и
// заодно собирает в одном месте всё состояние необратимой операции.
//
// Ключевое здесь — видимая ошибка. Раньше провал запроса только возвращал
// кнопку в исходное состояние: человек нажал «Удалить», ничего не произошло,
// и понять, удалён аккаунт или нет, было невозможно. Для операции без отмены
// это худший из возможных исходов, поэтому текст ошибки прямо говорит, что
// данные на месте.
export function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  function confirm() {
    setDeleting(true);
    setError('');
    api
      .deleteAllUserData()
      .then(() => {
        window.location.reload();
      })
      .catch(() => {
        setDeleting(false);
        setError(
          'Не удалось удалить аккаунт. Данные на месте — проверьте соединение и попробуйте ещё раз.',
        );
      });
  }

  return (
    <div
      role="presentation"
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={() => !deleting && onClose()}
    >
      <div role="presentation" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 12, padding: '28px 28px 32px', width: '100%', maxWidth: 420, border: '1px solid rgba(var(--fg-rgb),0.08)' }}>
        <div style={{ fontSize: 22, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Удалить аккаунт?</div>
        <div style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.6, marginBottom: 24 }}>
          Все данные будут удалены безвозвратно: дневники, записи, прогресс, настройки. Восстановить невозможно.
        </div>
        {error && (
          <div role="alert" style={{ fontSize: 14, color: 'var(--c-rose)', lineHeight: 1.5, marginBottom: 16 }}>{error}</div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            disabled={deleting}
            style={{ flex: 1, padding: '13px', borderRadius: 14, border: '1px solid var(--line)', background: 'transparent', color: 'var(--text)', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Отмена
          </button>
          <button
            onClick={confirm}
            disabled={deleting}
            style={{ flex: 1, padding: '13px', borderRadius: 14, border: 'none', background: 'var(--c-rose)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: deleting ? 'default' : 'pointer', fontFamily: 'inherit', opacity: deleting ? 0.6 : 1 }}
          >
            {deleting ? 'Удаляем...' : 'Удалить'}
          </button>
        </div>
      </div>
    </div>
  );
}
