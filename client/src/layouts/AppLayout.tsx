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
  { to: '/balance', label: 'Balance', icon: 'balance', managerOnly: true },
  { to: '/reports', label: 'Reportes', icon: 'reports', managerOnly: true },
];

const BREADCRUMBS: Record<string, string> = {
  dashboard: 'Dashboard',
  orders: 'Órdenes',
  team: 'Equipo',
  sla: 'SLA',
  balance: 'Balance',
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
    const [path, query] = to.split('?');
    if (query) return location.search === `?${query}`;
    const matchingQueryItem = items.some(
      (item) => item.to.startsWith(`${path}?`) && location.search === `?${item.to.split('?')[1]}`,
    );
    return !matchingQueryItem;
  };

  return (
    <div className="min-h-screen w-full bg-background lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <a href="#contenido-principal" className="skip-link">Ir al contenido</a>

      {menuOpen ? (
        <button
          type="button"
          aria-label="Cerrar navegación"
          className="fixed inset-0 z-40 bg-brand-900/45 backdrop-blur-sm lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <aside
        id="menu-principal"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-hidden border-r border-white/10 bg-brand-900 text-white shadow-[var(--shadow-float)] transition-transform duration-300 lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:w-auto lg:translate-x-0',
          menuOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="zl-grid-pattern border-b border-white/10 p-4 pb-5">
          <div className="flex items-center justify-between gap-3">
            <Link to="/dashboard" onClick={() => setMenuOpen(false)} className="flex h-14 items-center rounded-2xl bg-white px-3.5 shadow-sm">
              <img src="/logo.webp" alt="Zorzal Lirio OS" className="h-7 w-auto" />
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10 lg:hidden"
              aria-label="Cerrar navegación"
              onClick={() => setMenuOpen(false)}
            >
              <Icon name="close" className="size-5" />
            </Button>
          </div>
          <p className="mt-4 text-[10px] font-bold tracking-[0.16em] text-gold-500 uppercase">Centro operativo</p>
          <p className="mt-1 font-display text-lg font-semibold text-white">Control de producción</p>
        </div>

        <nav aria-label="Navegación principal" className="zl-scroll flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
          <p className="px-3 pt-2 pb-1 text-[10px] font-bold tracking-[0.14em] text-white/35 uppercase">Navegación</p>
          {items.map((item) => (
            <NavLink
              key={`${item.to}-${item.label}`}
              to={item.to}
              end={item.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  'group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-white/65 hover:bg-white/8 hover:text-white',
                  isCurrent(item.to, isActive) && 'bg-gold-500 text-brand-900 shadow-sm hover:bg-gold-500 hover:text-brand-900',
                )
              }
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-white/7 group-hover:bg-white/10">
                <Icon name={item.icon} />
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <Link
            to="/profile"
            onClick={() => setMenuOpen(false)}
            className={cn(
              'flex items-center gap-3 rounded-xl p-2.5 hover:bg-white/8',
              location.pathname === '/profile' && 'bg-white/10',
            )}
          >
            <Avatar user={session} size="sm" />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-xs font-semibold text-white">{session.name}</span>
              <span className="mt-0.5 block text-[10px] text-white/45">{ROLE_LABELS[session.role]}</span>
            </span>
            <Icon name="profile" className="text-white/40" />
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 w-full justify-start text-white/60 hover:bg-white/8 hover:text-white"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            Salir del sistema
          </Button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-line/70 bg-background/90 px-3 py-3 backdrop-blur-xl lg:hidden">
          <div className="flex min-h-14 items-center justify-between rounded-[1.25rem] border border-line bg-surface px-3 shadow-[var(--shadow-tile)]">
            <Link to="/dashboard" className="flex h-10 items-center rounded-xl bg-white px-2.5 ring-1 ring-line">
              <img src="/logo.webp" alt="Zorzal Lirio OS" className="h-6 w-auto" />
            </Link>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Abrir navegación"
              aria-expanded={menuOpen}
              aria-controls="menu-principal"
              onClick={() => setMenuOpen(true)}
            >
              <Icon name="menu" className="size-5" />
            </Button>
          </div>
        </header>

        <div className="mx-auto max-w-[100rem] px-4 pt-4 sm:px-6">
          <nav aria-label="Ruta de navegación" className="hidden text-[11px] font-medium text-muted sm:block">
            <ol className="flex items-center gap-1.5">
              <li><Link to="/dashboard" className="hover:text-ink">Inicio</Link></li>
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
    </div>
  );
}
