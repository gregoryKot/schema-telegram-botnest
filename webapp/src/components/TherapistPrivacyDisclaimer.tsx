import { useHistorySheet } from '../hooks/useHistorySheet';

export const THERAPIST_DISCLAIMER_KEY = 'therapist_privacy_disclaimer_seen';

export function shouldShowTherapistDisclaimer(): boolean {
  return !localStorage.getItem(THERAPIST_DISCLAIMER_KEY);
}

interface Props {
  onDone: () => void;
}

/**
 * Первый вход в кабинет терапевта: короткий этический дисклеймер о том, что
 * клиентов лучше записывать под инициалами/псевдонимом, а не полным именем.
 * Показывается один раз (флаг в localStorage).
 */
export function TherapistPrivacyDisclaimer({ onDone }: Props) {
  const goBack = useHistorySheet(onDone);

  function acknowledge() {
    localStorage.setItem(THERAPIST_DISCLAIMER_KEY, '1');
    goBack();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 260,
      background: 'var(--bg)', overflowY: 'auto',
    }}>
      <div style={{ maxWidth: 540, margin: '0 auto', padding: '56px 24px 40px' }}>

        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🕊️</div>
          <h1 style={{
            fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 400,
            color: 'var(--text)', lineHeight: 1.2, marginBottom: 14,
          }}>
            Безопасность клиента — превыше всего
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.7 }}>
            Прежде чем вы начнёте вести клиентов — одна важная просьба.
          </p>
        </div>

        <p style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.75, marginBottom: 18 }}>
          Пожалуйста, <span style={{ fontWeight: 600 }}>не указывайте настоящие имена и фамилии клиентов</span> —
          ни в имени клиента, ни в заметках, ни в сессиях. Используйте инициалы, кодовое
          обозначение или псевдоним, по которому клиента узнаёте только вы.
        </p>

        <p style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.75, marginBottom: 20 }}>
          Это не наша выдумка, а профессиональный стандарт. Так делают даже с бумажными
          записями: этические кодексы просят обезличивать данные, чтобы записи, попав
          не в те руки, нельзя было связать с конкретным человеком.
        </p>

        <div style={{
          background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent) 16%, transparent)',
          borderRadius: 14, padding: '16px 18px', marginBottom: 22,
        }}>
          <div style={{ fontSize: 13.5, color: 'var(--text-sub)', lineHeight: 1.7 }}>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Этический кодекс психолога РПО</span> и{' '}
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>APA (стандарт 6.02)</span> прямо
            требуют кодировать данные и убирать идентифицирующие сведения при их хранении
            и передаче — вместо реальных имён.
          </div>
        </div>

        <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.75, marginBottom: 32 }}>
          Со своей стороны мы защищаем данные по максимуму: всё чувствительное шифруется
          (AES-256), доступ есть только у вас. Но ни одно шифрование не отменяет базовой
          гигиены. Чем меньше персональных данных попадёт в систему — тем спокойнее и вам,
          и клиенту. Будьте бдительны.
        </p>

        <button
          onClick={acknowledge}
          className="ex-btn ex-btn-primary"
          style={{ width: '100%', padding: '16px', fontSize: 16 }}
        >
          Понятно, буду беречь клиентов
        </button>
      </div>
    </div>
  );
}
