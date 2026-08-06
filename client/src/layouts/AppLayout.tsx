import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ROLE_LABELS } from '@shared/constants/enums';
import { isManager } from '@shared/lib/permissions';
import { Avatar } from '../components/indicators';
import { Button } from '../components/ui';
import { cn } from '../lib/format';
import { useLogout, useSession } from '../services/queries';

interface NavItem {
  to: string;
  label: string;
  managerOnly?: boolean;
  plantOnly?: boolean;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/orders', label: 'Ordenes', managerOnly: true },
  { to: '/orders?assignee=me', label: 'Mis ordenes', plantOnly: true },
  { to: '/orders', label: 'Ordenes de mis etapas', plantOnly: true, end: true },
  { to: '/team', label: 'Equipo', managerOnly: true },
  { to: '/sla', label: 'SLA', managerOnly: true },
  { to: '/reports', label: 'Reportes', managerOnly: true },
  { to: '/profile', label: 'Perfil' },
];

const BREADCRUMBS: Record<string, string> = {
  dashboard: 'Dashboard',
  orders: 'Ordenes',
  team: 'Equipo',
  sla: 'SLA',
  reports: 'Reportes',
  profile: 'Perfil',
};

export function AppLayout() {
  const location = useLocation();
  const { data: session } = useSession();
  const logout = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!session) return null;

  const manager = isManager(session.role);
  const items = NAV_ITEMS.filter((item) => {
    if (item.managerOnly) return manager;
    if (item.plantOnly) return !manager;
    return true;
  });

  const segments = location.pathname.split('/').filter(Boolean);
  const crumbs = segments.map((segment, index) => ({
    label: BREADCRUMBS[segment] ?? segment,
    path: `/${segments.slice(0, index + 1).join('/')}`,
  }));

  return (
    <div className="flex min-h-screen w-full flex-col bg-background lg:flex-row">
      <header className="flex items-center justify-between gap-2 border-b border-line bg-brand-900 px-3 py-2 text-white lg:hidden">
        <Link to="/dashboard" className="rounded-lg bg-white px-2.5 py-1.5">
          <img src="/logo.webp" alt="Zorzal Lirio OS" className="h-5 w-auto" />
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/10"
          aria-expanded={menuOpen}
          aria-controls="menu-principal"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? 'Cerrar' : 'Menu'}
        </Button>
      </header>

      <nav
        id="menu-principal"
        aria-label="Navegacion principal"
        className={cn(
          'shrink-0 border-line bg-brand-900 text-white lg:block lg:w-60 lg:border-r',
          menuOpen ? 'block' : 'hidden',
        )}
      >
        {/* Celda blanca del logo incrustada en la barra oscura: el propio patron bento. */}
        <div className="hidden p-3 lg:block">
          <Link to="/dashboard" className="block rounded-2xl bg-white px-3.5 py-3">
            <img src="/logo.webp" alt="Zorzal Lirio OS" className="h-7 w-auto" />
          </Link>
          <p className="mt-2 px-1 text-xs font-medium tracking-wide text-white/50 uppercase">
            Control de produccion
          </p>
        </div>
        <ul className="flex flex-col gap-0.5 p-2 lg:pt-1">
          {items.map((item) => (
            <li key={`${item.to}-${item.label}`}>
              <NavLink
                to={item.to}
                end={item.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive && location.search === (item.to.split('?')[1] ? `?${item.to.split('?')[1]}` : '')
                      ? 'bg-gold-500 font-semibold text-brand-900'
                      : 'text-white/80 hover:bg-white/10',
                  )
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="hidden items-center justify-between gap-4 border-b border-line bg-surface px-5 py-2.5 lg:flex">
          <nav aria-label="Ruta de navegacion" className="text-xs text-muted">
            <ol className="flex items-center gap-1">
              <li>
                <Link to="/dashboard" className="hover:text-ink">
                  Inicio
                </Link>
              </li>
              {crumbs.map((crumb) => (
                <li key={crumb.path} className="flex items-center gap-1">
                  <span aria-hidden="true">/</span>
                  <Link to={crumb.path} className="hover:text-ink">
                    {crumb.label}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-xs text-muted">
              <Avatar user={session} size="sm" />
              <span className="text-ink">{session.name}</span>
              <span className="rounded border border-line px-1.5 py-0.5">
                {ROLE_LABELS[session.role]}
              </span>
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
            >
              Cerrar sesion
            </Button>
          </div>
        </div>

        <main className="min-w-0 flex-1 p-4 lg:p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
