// Обёртка отдельных страниц записи на визитке (/booking/paid, /booking/manage,
// /book): фон и токены сайта без шапки лендинга. Одна точка для всех — чтобы
// страница по ссылке и экран после оплаты не разъезжались видом.
export const page: React.CSSProperties = {
  // #root is a flex row — fill it (flex:1 + width:100%), else the column shrinks
  // to content width and pins left on desktop.
  flex: 1, width: '100%', boxSizing: 'border-box',
  background: 'var(--bg)', color: 'var(--text)', minHeight: '100dvh',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px',
};
export const h1: React.CSSProperties = { fontFamily: 'var(--serif)', fontSize: 'clamp(26px,6vw,34px)', fontWeight: 400, lineHeight: 1.15, letterSpacing: '-.01em', margin: '0 0 10px' };
export const sub: React.CSSProperties = { fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.7, margin: '0 0 24px' };
export const backLink: React.CSSProperties = { display: 'inline-block', marginTop: 32, fontSize: 13, color: 'var(--text-faint)', textDecoration: 'none' };
