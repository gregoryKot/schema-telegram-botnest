import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/index-tail.css' // хвост index.css: разделы экранов, вынесенные из него, — сразу за ним
import '../../shared/src/theme/utilities.css' // утилиты — строго ПОСЛЕ index.css и хвоста (почему — в самом файле)
// Примитивы живой бумаги (components/paper/*) — в главном чанке после cabinet.css и paper.css: подключённый
// из компонентов, файл уезжал в общий чанк перед index.css, и ds-label/pp-paper перебивали его правила (g4).
import './styles/paper-app.css'
import App from './App.tsx'
import { installChunkReloadListener } from './utils/chunkReload'

// Устаревший чанк после деплоя — перезагрузка на свежую версию (chunkReload.ts).
installChunkReloadListener()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
