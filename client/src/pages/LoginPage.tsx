import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { loginSchema, type LoginInput } from '@shared/schemas/auth';
import { Button, Field, Icon, Input, type IconName } from '../components/ui';
import { ApiError } from '../lib/api';
import { cn } from '../lib/format';
import { useLogin, useSession } from '../services/queries';

interface FeatureTileProps {
  icon: IconName;
  title: string;
  detail: string;
  className?: string;
}

function FeatureTile({ icon, title, detail, className }: FeatureTileProps) {
  return (
    <article className={cn('group rounded-[1.35rem] border border-white/12 bg-white/[0.06] p-4 backdrop-blur-sm', className)}>
      <span className="flex size-9 items-center justify-center rounded-xl bg-gold-500 text-brand-900 transition-transform group-hover:-translate-y-0.5">
        <Icon name={icon} />
      </span>
      <h2 className="mt-5 text-sm font-semibold text-white">{title}</h2>
      <p className="mt-1 max-w-48 text-xs leading-relaxed text-white/58">{detail}</p>
    </article>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session, isPending } = useSession();
  const login = useLogin();
  const [passwordVisible, setPasswordVisible] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  if (!isPending && session) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/login' ? from : '/dashboard'} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    const user = await login.mutateAsync(values);
    navigate(user.mustChangePassword ? '/profile' : '/dashboard', { replace: true });
  });

  const serverError =
    login.error instanceof ApiError ? login.error.message : login.error ? 'No se pudo iniciar sesión.' : null;

  return (
    <main className="grid min-h-screen grid-cols-1 gap-3 bg-background p-3 lg:grid-cols-[1.12fr_0.88fr] lg:p-4">
      <section className="zl-grid-pattern relative hidden min-h-[calc(100vh-2rem)] overflow-hidden rounded-[2rem] bg-brand-900 p-8 text-white lg:flex lg:flex-col lg:justify-between xl:p-12">
        <span aria-hidden="true" className="absolute -top-32 -right-24 size-96 rounded-full border border-white/10" />
        <span aria-hidden="true" className="absolute -top-16 -right-8 size-64 rounded-full border border-gold-500/25" />

        <div className="relative">
          <div className="inline-flex rounded-2xl bg-white px-4 py-3 shadow-[var(--shadow-float)]">
            <img src="/logo.webp" alt="Zorzal Lirio OS" className="h-8 w-auto" />
          </div>
          <p className="mt-10 text-xs font-bold tracking-[0.16em] text-gold-500 uppercase">Centro operativo</p>
          <h1 className="mt-3 max-w-2xl text-5xl leading-[0.98] font-semibold tracking-[-0.055em] xl:text-6xl">
            Cada orden, etapa y responsable en un solo lugar.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-white/65">
            Zorzal Lirio OS coordina la producción de uniformes con trazabilidad, alertas y decisiones claras.
          </p>
        </div>

        <div className="bento-grid relative grid grid-cols-2 gap-3 xl:grid-cols-4">
          <FeatureTile icon="orders" title="Tablero Kanban" detail="Órdenes visibles por etapa y responsable." className="xl:col-span-2" />
          <FeatureTile icon="clock" title="SLA automático" detail="Prioridades antes de que un pedido venza." />
          <FeatureTile icon="activity" title="Historial" detail="Cada movimiento queda registrado." />
          <FeatureTile icon="reports" title="Reportes" detail="Carga, tiempos y cuellos de botella." className="col-span-2 xl:col-span-4" />
        </div>
      </section>

      <section className="paper-grid flex min-h-[calc(100vh-1.5rem)] items-center justify-center rounded-[2rem] border border-line bg-surface/75 px-5 py-12 lg:min-h-[calc(100vh-2rem)] xl:px-12">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <div className="inline-flex rounded-2xl border border-line bg-white px-4 py-3 shadow-[var(--shadow-tile)]">
              <img src="/logo.webp" alt="Zorzal Lirio OS" className="h-7 w-auto" />
            </div>
          </div>

          <div className="mb-8">
            <p className="text-xs font-bold tracking-[0.14em] text-brand-700 uppercase">Acceso interno</p>
            <h2 className="mt-2 text-4xl leading-none font-semibold text-ink sm:text-5xl">Bienvenido de vuelta</h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
              Ingresa tus credenciales para continuar con la jornada de producción.
            </p>
          </div>

          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5 rounded-[1.5rem] border border-line bg-surface p-5 shadow-[var(--shadow-tile)] sm:p-7">
            {serverError ? (
              <p role="alert" className="rounded-xl border border-danger/35 bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
                {serverError}
              </p>
            ) : null}

            <Field label="Correo" htmlFor="email" required error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                autoFocus
                placeholder="nombre@zorzallirio.com"
                aria-invalid={Boolean(errors.email)}
                {...register('email')}
              />
            </Field>

            <Field label="Contraseña" htmlFor="password" required error={errors.password?.message}>
              <div className="relative">
                <Input
                  id="password"
                  type={passwordVisible ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="pr-16"
                  aria-invalid={Boolean(errors.password)}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setPasswordVisible((visible) => !visible)}
                  className="absolute inset-y-0 right-1 px-3 text-xs font-semibold text-muted hover:text-ink"
                  aria-label={passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {passwordVisible ? 'Ocultar' : 'Ver'}
                </button>
              </div>
            </Field>

            <Button type="submit" className="mt-1 h-11 w-full" disabled={isSubmitting || login.isPending}>
              {login.isPending ? 'Ingresando…' : 'Entrar al sistema'}
              {!login.isPending ? <Icon name="arrow" /> : null}
            </Button>

            <div className="flex items-start gap-2.5 border-t border-line pt-4 text-xs leading-relaxed text-muted">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success">
                <Icon name="check" className="size-3" />
              </span>
              El acceso está reservado al equipo. Solicita una cuenta al administrador de producción.
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
