import { Navigate, useLocation } from 'react-router-dom';

/** Редирект старого адреса, который не теряет состояние маршрута: `/exercises` с целью открывает её в «Практиках». */
export function KeepStateRedirect({ to }: { to: string }) {
  const { state, search } = useLocation();
  return <Navigate to={{ pathname: to, search }} state={state} replace />;
}
