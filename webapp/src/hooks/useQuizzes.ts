import { useEffect, useState } from 'react';
import { api, type QuizDto } from '../api';
import { useAuth } from '../auth/authContext';

// Загрузка контента мини-тестов с публичного API. Аноним получает «ты»
// (дефолт проекта); залогиненный с формой «вы» — «вы»-контент (правило
// ты/вы: юзер с «вы» не должен нигде увидеть «ты»).
export function useQuizzes(): { quizzes: QuizDto[] | null; error: boolean } {
  const { isAuthenticated, isLoading } = useAuth();
  const [quizzes, setQuizzes] = useState<QuizDto[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    let cancelled = false;
    (async () => {
      try {
        let form: 'ty' | 'vy' | undefined;
        if (isAuthenticated) {
          const settings = await api.getSettings().catch(() => null);
          if (settings?.addressForm === 'vy') form = 'vy';
        }
        const res = await api.getQuizzes(form);
        if (!cancelled) setQuizzes(res.quizzes);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading]);

  return { quizzes, error };
}
