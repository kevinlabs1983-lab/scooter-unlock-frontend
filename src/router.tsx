import { createBrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import Admin from './pages/Admin.tsx'
import AGB from './pages/legal/AGB.tsx'
import Datenschutz from './pages/legal/Datenschutz.tsx'
import Impressum from './pages/legal/Impressum.tsx'
import Widerruf from './pages/legal/Widerruf.tsx'
import Shop from './pages/Shop.tsx'
import Success from './pages/Success.tsx'
import Tuner from './pages/Tuner.tsx'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Shop /> },
      { path: 'shop', element: <Shop /> },
      { path: 'tuner', element: <Tuner /> },
      { path: 'success', element: <Success /> },
      { path: 'admin', element: <Admin /> },
      { path: 'impressum', element: <Impressum /> },
      { path: 'datenschutz', element: <Datenschutz /> },
      { path: 'agb', element: <AGB /> },
      { path: 'widerruf', element: <Widerruf /> },
    ],
  },
])
