// Стили экрана возврата с оплаты (BookingPaidPage и его части). page/h1/sub/
// backLink — общие для страниц записи, в bookingPageStyles.ts.
export const icon: React.CSSProperties = {
  width: 56, height: 56, margin: '0 auto 20px', borderRadius: '50%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(var(--accent-rgb),0.10)', color: 'var(--accent)', fontSize: 28,
};
export const card: React.CSSProperties = { background: 'rgba(var(--fg-rgb),0.04)', border: '1px solid var(--line)', borderRadius: 'var(--r-14)', padding: '16px 18px', margin: '0 0 18px' };
export const primaryBtn: React.CSSProperties = {
  display: 'block', width: '100%', boxSizing: 'border-box', textAlign: 'center', padding: '14px',
  fontSize: 15, fontWeight: 600, fontFamily: 'inherit', background: 'var(--accent)', color: '#fff',
  border: 'none', borderRadius: 'var(--r-12)', cursor: 'pointer', textDecoration: 'none',
};
export const ghostBtn: React.CSSProperties = { ...primaryBtn, background: 'transparent', color: 'var(--accent)', border: '1.5px solid var(--accent)' };
export const hint: React.CSSProperties = { fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.6, margin: '14px 0 22px' };
