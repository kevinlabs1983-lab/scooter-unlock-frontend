import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Footer } from './components/Footer.tsx'
import { IosSafariBanner } from './components/IosSafariBanner.tsx'

function shouldShowIosBanner(pathname: string): boolean {
  return pathname === '/' || pathname === '/shop' || pathname === '/tuner'
}

function App() {
  const { pathname } = useLocation()
  const showIosBanner = shouldShowIosBanner(pathname)

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b border-border bg-surface/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link
            to="/"
            className="text-xl font-semibold tracking-tight text-foreground transition-colors hover:text-accent"
          >
            <span className="text-accent">🛴</span> Scooter Unlock
          </Link>

          <nav className="flex items-center gap-2">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                [
                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-300',
                  isActive
                    ? 'border-accent/50 bg-accent/10 text-accent'
                    : 'border-border text-muted hover:border-accent/40 hover:text-accent',
                ].join(' ')
              }
            >
              Shop
            </NavLink>
          </nav>
        </div>
      </header>

      {showIosBanner && <IosSafariBanner />}

      <div className="flex flex-1 flex-col">
        <Outlet />
      </div>

      <Footer />
    </div>
  )
}

export default App
