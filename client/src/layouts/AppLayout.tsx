import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ROLE_LABELS } from '@shared/constants/enums';
import { isManager } from '@shared/lib/permissions';
import { Avatar } from '../components/indicators';
import { Button, Icon, type IconName } from '../components/ui';
import { cn } from '../lib/format';
import { useLogout, useSession } from '../services/queries';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  managerOnly?: boolean;
  plantOnly?: boolean;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/orders', label: 'Órdenes', icon: 'orders', managerOnly: true },
  { to: '/orders?assignee=me', label: 'Mis órdenes', icon: 'profile', plantOnly: true },
  { to: '/orders', label: 'Mis etapas', icon: 'orders', plantOnly: true, end: true },
  { to: '/team', label: 'Equipo', icon: 'team', managerOnly: true },
  { to: '/sla', label: 'SLA', icon: 'clock', managerOnly: true },
  { to: '/reports', label: 'Reportes', icon: 'reports', managerOnly: true },
];

const BREADCRUMBS: Record<string, string> = {
  dashboard: 'Dashboard',
  orders: 'Órdenes',
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

  const isCurrent = (to: string, isActive: boolean) => {
    if (!isActive) return false;
    const query = to.includes('?') ? `?${to.split('?')[1]}` : '';
    return query ? location.search === query : !location.search;
  };

  return (
    <div className="min-h-screen w-full bg-background">
      <a href="#contenido-principal" className="skip-link">
        Ir al contenido
      </a>

      <header className="sticky top-0 z-40 border-b border-line/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto max-w-[100rem] px-3 py-3 sm:px-5">
          <div className="flex min-h-16 items-center gap-3 rounded-[1.35rem] border border-line bg-surface px-3 shadow-[var(--shadow-tile)] sm:px-4">
            <Link to="/dashboard" className="flex shrink-0 items-center gap-3 rounded-xl py-2 pr-2">
              <span className="flex h-10 items-center rounded-xl bg-white px-2.5 ring-1 ring-line">
                <img src="/logo.webp" alt="Zorzal Lirio OS" className="h-6 w-auto" />
              </span>
              <span className="hidden border-l border-line pl-3 leading-tight 2xl:block">
                <span className="block font-display text-sm font-semibold text-ink">Producción</span>
                <span className="block text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">Centro operativo</span>
              </span>
            </Link>

            <nav aria-label="Navegación principal" className="ml-1 hidden min-w-0 flex-1 items-center gap-1 xl:flex">
              {items.map((item) => (
                <NavLink
                  key={`${item.to}-${item.label}`}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'group relative inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold whitespace-nowrap text-muted hover:bg-surface-muted hover:text-ink',
                      isCurrent(item.to, isActive) && 'bg-brand-900 text-white hover:bg-brand-900 hover:text-white',
                    )
                  }
                >
                  <Icon name={item.icon} className="size-3.5" />
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="ml-auto hidden shrink-0 items-center gap-2 xl:flex">
              <Link
                to="/profile"
                className={cn(
                  'flex items-center gap-2 rounded-xl border border-transparent px-2 py-1.5 hover:border-line hover:bg-background',
                  location.pathname === '/profile' && 'border-line bg-background',
                )}
              >
                <Avatar user={session} size="sm" />
                <span className="hidden max-w-28 leading-tight 2xl:block">
                  <span className="block truncate text-xs font-semibold text-ink">{session.name}</span>
                  <span className="block text-[10px] text-muted">{ROLE_LABELS[session.role]}</span>
                </span>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                disabled={logout.isPending}
                onClick={() => logout.mutate()}
              >
                Salir
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="ml-auto xl:hidden"
              aria-label={menuOpen ? 'Cerrar navegación' : 'Abrir navegación'}
              aria-expanded={menuOpen}
              aria-controls="menu-principal"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Icon name={menuOpen ? 'close' : 'menu'} className="size-5" />
            </Button>
          </div>

          <div
            id="menu-principal"
            className={cn(
              'mt-2 rounded-[1.35rem] border border-line bg-surface p-2 shadow-[var(--shadow-float)] xl:hidden',
              menuOpen ? 'block' : 'hidden',
            )}
          >
            <nav aria-label="Navegación móvil" className="grid gap-1 sm:grid-cols-2">
              {items.map((item) => (
                <NavLink
                  key={`${item.to}-${item.label}`}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-surface-muted hover:text-ink',
                      isCurrent(item.to, isActive) && 'bg-brand-900 text-white hover:bg-brand-900 hover:text-white',
                    )
                  }
                >
                  <Icon name={item.icon} />
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-2 flex items-center gap-3 border-t border-line px-2 pt-3 pb-1">
              <Avatar user={session} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-ink">{session.name}</p>
                <p className="text-[11px] text-muted">{ROLE_LABELS[session.role]}</p>
              </div>
              <Link to="/profile" onClick={() => setMenuOpen(false)} className="text-xs font-semibold text-brand-700">
                Perfil
              </Link>
              <Button variant="ghost" size="sm" disabled={logout.isPending} onClick={() => logout.mutate()}>
                Salir
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[100rem] px-4 pt-3 sm:px-6">
        <nav aria-label="Ruta de navegación" className="hidden text-[11px] font-medium text-muted sm:block">
          <ol className="flex items-center gap-1.5">
            <li>
              <Link to="/dashboard" className="hover:text-ink">Inicio</Link>
            </li>
            {crumbs.map((crumb) => (
              <li key={crumb.path} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="text-brand-300">/</span>
                <Link to={crumb.path} className="hover:text-ink">{crumb.label}</Link>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      <main id="contenido-principal" className="mx-auto min-w-0 max-w-[100rem] px-4 pt-5 pb-12 sm:px-6 sm:pt-6">
        <Outlet />
      </main>
    </div>
  );
}
