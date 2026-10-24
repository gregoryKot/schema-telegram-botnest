import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { ConnectionTrouble } from '../../../shared/src/components/ConnectionTrouble';
import { AddressFormPicker } from './AddressFormPicker';
import { AddressFormProvider } from '../utils/AddressFormProvider';
import { UiPrefsGate } from './UiPrefsGate';

/** Auth guard как layout-маршрут: приватные страницы доступны только после входа. */
export function RequireAuth() {
  const { isAuthenticated, isLoading, authError, refreshToken } = useAuth();
  if (isLoading) return <div className="loader-center"><div className="spinner" /></div>;
  if (!isAuthenticated) return authError === 'transient' ? <ConnectionTrouble onRetry={() => void refreshToken()} /> : <Navigate to="/login" replace />;
  return (
    <AddressFormProvider>
      <AddressFormPicker />
      <UiPrefsGate><Outlet /></UiPrefsGate>
    </AddressFormProvider>
  );
}
