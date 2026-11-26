import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { ConnectionTrouble } from '../../../shared/src/components/ConnectionTrouble';
import { rememberLaunchParam } from '../../../shared/src/host/startParam';
import { rememberReturnTo } from '../auth/returnTo';
import { AddressFormProvider } from '../utils/AddressFormProvider';
import { UiPrefsGate } from './UiPrefsGate';
import { StepUpProvider } from './stepUp/StepUpProvider';
import { ConnectionOutcome, GateSkeleton } from './AuthGateViews';
import { useRetrying } from './useRetrying';

/** Auth guard (layout-маршрут): пока вход поднимается — силуэт экрана (AuthGateViews); StepUpProvider — окно кода 2FA (S12). */
export function RequireAuth() {
  const { isAuthenticated, isLoading, authError, refreshToken } = useAuth();
  const { pathname, search } = useLocation();
  const [retrying, retry] = useRetrying(refreshToken); // «Повторить» видно занятым, пока refresh идёт
  useEffect(() => { // без входа параметр запуска ждёт входа (useStartParam), адрес — экран входа (E14, returnTo.ts)
    if (isAuthenticated) return;
    rememberLaunchParam(search);
    if (!isLoading && authError !== 'transient') rememberReturnTo(pathname + search);
  }, [isAuthenticated, isLoading, authError, pathname, search]);
  if (isLoading) return <GateSkeleton pathname={pathname} />;
  if (!isAuthenticated) return authError === 'transient' ? <ConnectionTrouble onRetry={retry} retrying={retrying} Frame={ConnectionOutcome} /> : <Navigate to="/login" replace />;
  return <AddressFormProvider><StepUpProvider><UiPrefsGate><Outlet /></UiPrefsGate></StepUpProvider></AddressFormProvider>;
}
