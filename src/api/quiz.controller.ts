import { Controller, Get, Query } from '@nestjs/common';
import { normalizeAddressForm } from '../notification/address-form';
import { buildQuizzes } from '../quiz/quiz-registry';
import type { Quiz } from '../quiz/quiz.types';

// Публичная выдача контента мини-тестов для сайта (лид-магнит «тесты без
// регистрации» — auth-гарда нет намеренно). Контент статический, из
// quiz-registry — единый источник правды с ботом; PII/БД не затрагивается.
// Троттлинг — глобальный UserThrottlerGuard по IP (правило №5).
// ?form=ty|vy — форма обращения; всё неизвестное падает в «ты» (дефолт
// проекта для анонимов).
@Controller('api')
export class QuizController {
  @Get('quizzes')
  list(@Query('form') form?: string): { quizzes: Quiz[] } {
    return { quizzes: buildQuizzes(normalizeAddressForm(form)) };
  }
}
