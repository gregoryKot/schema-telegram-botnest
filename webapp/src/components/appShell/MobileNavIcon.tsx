// Иконки нижней навигации AppShell — чистый SVG-рендер по разделу.
// Вынесено из AppShell.tsx (правило №10, ~150 строк — компонент без логики).
export type MobileNavIconId = 'today' | 'diary' | 'more' | 'schemas' | 'profile' | 'practice' | 'clients' | 'search';

export function MobileNavIcon({ id }: { id: MobileNavIconId }) {
  const a = { fill: 'none' as const, stroke: 'currentColor', strokeWidth: '1.8', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (id === 'today') return (
    <svg width={20} height={20} viewBox="0 0 24 24" {...a}>
      <rect x="3" y="4" width="18" height="18" rx="3"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
  if (id === 'diary') return (
    <svg width={20} height={20} viewBox="0 0 24 24" {...a}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  );
  if (id === 'more') return (
    <svg width={20} height={20} viewBox="0 0 24 24" {...a}>
      <circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>
    </svg>
  );
  if (id === 'schemas') return (
    <svg width={20} height={20} viewBox="0 0 24 24" {...a}>
      <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
    </svg>
  );
  if (id === 'practice') return (
    <svg width={20} height={20} viewBox="0 0 24 24" {...a}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  );
  if (id === 'clients') return (
    <svg width={20} height={20} viewBox="0 0 24 24" {...a}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
  if (id === 'search') return (
    <svg width={20} height={20} viewBox="0 0 24 24" {...a}>
      <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" {...a}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  );
}
