// Что делать, когда войти не удалось — один блок на мини-апп и на сайт
// (правило №3 CLAUDE.md: экран-тупик у обоих фронтендов один и тот же).
//
// Два вопроса, на которые экран обязан ответить: что сделать самому и куда
// написать, если это не помогло. Раньше был ответ только на первый, а вместо
// второго стояло «напиши нам» — без имени и адреса.
//
// Обращения в тексте нет намеренно: экран показывается ДО входа, профиль ещё
// не загружен, и форма (ты/вы) неизвестна — вилку строить не из чего.
import type { HostId } from '../host/types';
import { supportContact } from '../utils/supportContact';

export function AuthFailureHelp({ hostId }: { hostId: HostId | undefined }) {
  const { url, label } = supportContact(hostId);
  const hostName = hostId === 'max' ? 'MAX' : 'Telegram';
  return (
    <>
      <div style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.6 }}>
        {`Попробовать закрыть приложение полностью и открыть заново — ${hostName} выдаст свежий пропуск. Не помогло — дело на нашей стороне.`}
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--accent)',
          textDecoration: 'none',
          // Зона нажатия ≥44 (CLAUDE.md: «одно очевидное действие»); ссылка
          // вторична по отношению к кнопке, поэтому не кнопка, а строка.
          minHeight: 44,
          padding: '0 12px',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        Написать автору → {label}
      </a>
    </>
  );
}
