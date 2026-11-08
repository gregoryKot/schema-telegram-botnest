import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/index-tail.css' // хвост index.css: разделы экранов, вынесенные из него, — сразу за ним
import '../../shared/src/theme/utilities.css' // утилиты — строго ПОСЛЕ index.css и хвоста (почему — в самом файле)
import App from './App.tsx'
import { installChunkReloadListener } from './utils/chunkReload'

// Устаревший чанк после деплоя — перезагрузка на свежую версию (chunkReload.ts).
installChunkReloadListener()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
