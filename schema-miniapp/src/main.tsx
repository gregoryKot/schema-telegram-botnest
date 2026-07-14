import { StrictMode, Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { AddressFormProvider } from './utils/addressForm';

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div
        style={{
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 16,
          textAlign: 'center',
          background: '#1a1a2e',
          color: '#e2e8f0',
        }}
      >
        <div style={{ fontSize: 40 }}>⚠️</div>
        <div style={{ fontSize: 17, fontWeight: 600 }}>Что-то пошло не так</div>
        <div
          style={{
            fontSize: 12,
            color: '#94a3b8',
            maxWidth: 300,
            wordBreak: 'break-word',
            lineHeight: 1.6,
          }}
        >
          {error.message}
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '13px 28px',
            border: 'none',
            borderRadius: 14,
            background: '#7c3aed',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Повторить
        </button>
      </div>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AddressFormProvider>
        <App />
      </AddressFormProvider>
    </ErrorBoundary>
  </StrictMode>,
);
