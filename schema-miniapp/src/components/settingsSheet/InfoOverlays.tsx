import { InfoSheetShell } from '../InfoSheetShell';
import { useTr } from '../../utils/addressForm';

export function NotifyInfoOverlay({ onClose }: { onClose: () => void }) {
  return (
    <InfoSheetShell title="Зачем уведомления" onClose={onClose}>
      <p
        style={{
          fontSize: 15,
          color: 'rgba(var(--fg-rgb),0.8)',
          lineHeight: 1.7,
          marginBottom: 14,
        }}
      >
        Регулярность — это всё. Один раз в день, в одно и то же время, формирует
        привычку наблюдать за собой.
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
    </InfoSheetShell>
  );
}
export function PairInfoOverlay({ onClose }: { onClose: () => void }) {
  const tr = useTr();
  return (
    <InfoSheetShell title="Зачем привязывать друга" onClose={onClose}>
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
        {tr('Ты', 'Вы')} и друг (партнёр, коллега) видите{' '}
        <b style={{ color: 'var(--text)' }}>индексы дня</b> друг друга — просто
        число от 0 до 10. Никаких деталей, дневников или оценок.
      </p>
      <p
        style={{
          fontSize: 14,
          color: 'var(--text-sub)',
          lineHeight: 1.7,
        }}
      >
        Иногда знать, что кому-то важно, как у {tr('тебя', 'вас')} дела — уже
        достаточно. Это мягкая взаимная видимость, без осуждения.
      </p>
    </InfoSheetShell>
  );
}
export function TherapistInfoOverlay({ onClose }: { onClose: () => void }) {
  const tr = useTr();
  return (
    <InfoSheetShell title="Зачем подключать терапевта" onClose={onClose}>
      <p
        style={{
          fontSize: 15,
          color: 'var(--text)',
          lineHeight: 1.7,
          marginBottom: 12,
        }}
      >
        {tr('Если ты работаешь', 'Если вы работаете')} со схема-терапевтом —
        приложение может стать частью этой работы.
      </p>
      <p
        style={{
          fontSize: 14,
          color: 'var(--text-sub)',
          lineHeight: 1.7,
          marginBottom: 12,
        }}
      >
        {tr(
          'Терапевт, которому ты дашь код, видит',
          'Терапевт, которому вы дадите код, видит',
        )}{' '}
        <b style={{ color: 'var(--text)' }}>трекер потребностей и задания</b>.{' '}
        {tr(
          'Карточки схем, профиль и дневники контролируешь ты — можно закрыть в настройках.',
          'Карточки схем, профиль и дневники контролируете вы — можно закрыть в настройках.',
        )}
      </p>
      <p
        style={{
          fontSize: 14,
          color: 'var(--text-sub)',
          lineHeight: 1.7,
        }}
      >
        Это даёт терапевту контекст без лишних объяснений — и позволяет работать
        с реальными паттернами, не с тем, что вспомнилось на сессии.
      </p>
    </InfoSheetShell>
  );
}
