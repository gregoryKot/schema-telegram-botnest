import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { ConnectionTrouble } from '../../../shared/src/components/ConnectionTrouble';
import { rememberLaunchParam } from '../../../shared/src/host/startParam';
import { AddressFormProvider } from '../utils/AddressFormProvider';
import { UiPrefsGate } from './UiPrefsGate';
import { StepUpProvider } from './stepUp/StepUpProvider';

/** Auth guard как layout-маршрут: приватные страницы доступны только после входа. */
export function RequireAuth() {
  const { isAuthenticated, isLoading, authError, refreshToken } = useAuth();
  const { search } = useLocation();
  // Ссылка-приглашение или кнопка уведомления без входа: /login теряет адрес,
  // параметр запуска ждёт входа (его заберёт useStartParam).
  useEffect(() => { if (!isAuthenticated) rememberLaunchParam(search); }, [isAuthenticated, search]);
  if (isLoading) return <div className="loader-center"><div className="spinner" /></div>;
  if (!isAuthenticated) return authError === 'transient' ? <ConnectionTrouble onRetry={() => void refreshToken()} /> : <Navigate to="/login" replace />;
  // StepUpProvider — окно кода 2FA для привязки и отвязки способов входа (S12).
  return <AddressFormProvider><StepUpProvider><UiPrefsGate><Outlet /></UiPrefsGate></StepUpProvider></AddressFormProvider>;
}
