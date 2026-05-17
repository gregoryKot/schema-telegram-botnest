import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';

type Section = 'today' | 'diary' | 'schemas' | 'profile' | 'help';

const NAV_ITEMS: { id: Section; icon: string; label: string }[] = [
  { id: 'today',   icon: '🏠', label: 'Сегодня' },
  { id: 'diary',   icon: '📔', label: 'Дневник' },
  { id: 'schemas', icon: '🧩', label: 'Схемы' },
  { id: 'profile', icon: '👤', label: 'Профиль' },
  { id: 'help',    icon: '💡', label: 'Помощь' },
];

function PlaceholderSection({ id }: { id: Section }) {
  const labels: Record<Section, string> = {
    today: 'Сегодня',
    diary: 'Дневник',
    schemas: 'Схемы и режимы',
    profile: 'Профиль',
    help: 'Помощь',
  };
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: 300, gap: 12, opacity: 0.4,
    }}>
      <div style={{ fontSize: 48 }}>{NAV_ITEMS.find(n => n.id === id)?.icon}</div>
      <p style={{ color: 'var(--text-sub)', fontSize: 15 }}>{labels[id]} — в разработке</p>
    </div>
  );
}

export function AppShell() {
  const { logout } = useAuth();
  const [section, setSection] = useState<Section>('today');

  return (
    <div className="app-layout">
      {/* ── Sidebar (desktop) ──────────────────────────────────────────────── */}
      <aside className="sidebar">
        {/* Brand */}
        <div style={{
          padding: '20px 16px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: '1px solid var(--border-color)',
          marginBottom: 8,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
            boxShadow: '0 4px 12px rgba(124, 114, 248, 0.3)',
          }}>🧠</div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>СхемаЛаб</span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, paddingTop: 4 }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-item${section === item.id ? ' active' : ''}`}
              onClick={() => setSection(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Bottom actions */}
        <div style={{ padding: '8px', borderTop: '1px solid var(--border-color)' }}>
          <button
            className="nav-item"
            onClick={() => logout()}
            style={{ color: 'var(--accent-red)' }}
          >
            <span className="nav-icon">🚪</span>
            Выйти
          </button>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="main-content">
        <div className="page-content animate-fade" key={section}>
          <PlaceholderSection id={section} />
        </div>
      </main>

      {/* ── Mobile bottom nav ───────────────────────────────────────────────── */}
      <nav className="mobile-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`mobile-nav-item${section === item.id ? ' active' : ''}`}
            onClick={() => setSection(item.id)}
          >
            <span className="mn-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
