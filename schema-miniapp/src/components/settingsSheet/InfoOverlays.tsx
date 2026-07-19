import { BottomSheet } from '../BottomSheet';

export function NotifyInfoOverlay({ onClose }: { onClose: () => void }) {
  return (
    <BottomSheet onClose={onClose} zIndex={300}>
      <div style={{ paddingTop: 8 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            marginBottom: 16,
          }}
        >
          Зачем уведомления
        </div>
        <p
          style={{
            fontSize: 15,
            color: 'rgba(var(--fg-rgb),0.8)',
            lineHeight: 1.7,
            marginBottom: 14,
          }}
        >
          Регулярность — это всё. Один раз в день, в одно и то же время,
          формирует привычку наблюдать за собой.
        </p>
        <p
          style={{
            fontSize: 15,
            color: 'rgba(var(--fg-rgb),0.8)',
            lineHeight: 1.7,
          }}
        >
          <b style={{ color: 'var(--text)' }}>Итоги дня</b> — приходят в это же
          время, если дневник заполнен.
        </p>
      </div>
    </BottomSheet>
  );
}

export function PairInfoOverlay({ onClose }: { onClose: () => void }) {
  return (
    <BottomSheet onClose={onClose} zIndex={300}>
      <div style={{ paddingTop: 8 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            marginBottom: 16,
          }}
        >
          Зачем привязывать друга
        </div>
        <p
          style={{
            fontSize: 15,
            color: 'var(--text)',
            lineHeight: 1.7,
            marginBottom: 12,
          }}
        >
          Это необязательно — но может помочь.
        </p>
        <p
          style={{
            fontSize: 14,
            color: 'var(--text-sub)',
            lineHeight: 1.7,
            marginBottom: 12,
          }}
        >
          Ты и друг (партнёр, коллега) видите{' '}
          <b style={{ color: 'var(--text)' }}>индексы дня</b> друг друга —
          просто число от 0 до 10. Никаких деталей, дневников или оценок.
        </p>
        <p
          style={{
            fontSize: 14,
            color: 'var(--text-sub)',
            lineHeight: 1.7,
          }}
        >
          Иногда знать, что кому-то важно как у тебя дела — уже достаточно. Это
          мягкая взаимная видимость, без осуждения.
        </p>
      </div>
    </BottomSheet>
  );
}

export function TherapistInfoOverlay({ onClose }: { onClose: () => void }) {
  return (
    <BottomSheet onClose={onClose} zIndex={300}>
      <div style={{ paddingTop: 8 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            marginBottom: 16,
          }}
        >
          Зачем подключать терапевта
        </div>
        <p
          style={{
            fontSize: 15,
            color: 'var(--text)',
            lineHeight: 1.7,
            marginBottom: 12,
          }}
        >
          Если ты работаешь со схема-терапевтом — приложение может стать частью
          этой работы.
        </p>
        <p
          style={{
            fontSize: 14,
            color: 'var(--text-sub)',
            lineHeight: 1.7,
            marginBottom: 12,
          }}
        >
          Терапевт, которому ты дашь код, видит{' '}
          <b style={{ color: 'var(--text)' }}>трекер потребностей и задания</b>.
          Карточки схем, профиль и дневники ты контролируешь сам — можно закрыть
          в настройках.
        </p>
        <p
          style={{
            fontSize: 14,
            color: 'var(--text-sub)',
            lineHeight: 1.7,
          }}
        >
          Это даёт терапевту контекст без лишних объяснений — и позволяет
          работать с реальными паттернами, не с тем, что вспомнилось на сессии.
        </p>
      </div>
    </BottomSheet>
  );
}
