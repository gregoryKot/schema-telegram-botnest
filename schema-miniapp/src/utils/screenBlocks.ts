// Реестр блоков экранов — один на оба фронтенда, живёт в shared
// (shared/src/screens/screenBlocks.ts; бэкенд сверяет его спекой
// screen-blocks-sync.invariants.spec.ts). Реэкспорт, чтобы импорты не менялись.
export * from '../../../shared/src/screens/screenBlocks';
