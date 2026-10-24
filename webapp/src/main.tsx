import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Классы-утилиты — строго ПОСЛЕ index.css (почему — в самом файле).
import '../../shared/src/theme/utilities.css'
import App from './App.tsx'
import { installChunkReloadListener } from './utils/chunkReload'

// Устаревший чанк после деплоя — перезагрузка на свежую версию (chunkReload.ts).
installChunkReloadListener()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
