/** Галочка «повторная встреча» и пояснение про персональную комнату. Только для платной сессии. */
export function ReturningVisitField({ returning, onChange }: { returning: boolean; onChange: (v: boolean) => void }) {
  return (
    <>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-10)', cursor: 'pointer' }}>
        <input type="checkbox" checked={returning} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 'var(--space-4)', flexShrink: 0, accentColor: 'var(--accent)', width: 16, height: 16 }} />
        <span style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.6 }}>
          Мы уже занимались — это повторная встреча
        </span>
      </label>
      <p style={{ fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.6, margin: '-8px 0 0' }}>
        {returning
          ? 'Хорошо! Укажите, пожалуйста, тот же контакт, что и в прошлый раз — я узнаю вас и открою вашу постоянную комнату для встреч. Если контакт не совпадёт, я не смогу вас найти и попрошу проверить.'
          : 'Если занимаемся впервые — я заведу для вас персональную комнату для встреч. Она будет одна и та же для всех наших будущих сессий, чтобы не искать новую ссылку каждый раз.'}
      </p>
    </>
  );
}
