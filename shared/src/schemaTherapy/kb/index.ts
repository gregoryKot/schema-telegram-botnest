// Сторож базы знаний (.claude/rules/knowledge-base.md): реестр таблиц по id, связи и их обратная
// сторона, известные дыры. Потребитель — тесты kb/*.test.ts; обратные функции ждут листов (BACKLOG).
export * from './check';
export * from './gaps';
export * from './links';
export * from './mentions';
export * from './tables';
