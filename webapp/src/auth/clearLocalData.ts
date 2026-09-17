// Переехало в shared (правило №3): та же чистка нужна и мини-аппу из ярлыка.
// Тонкий ре-экспорт — консьюмеры (AuthProvider) путь не меняют.
export { clearLocalData } from '../../../shared/src/auth/clearLocalData';
