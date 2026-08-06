import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { loginSchema, type LoginInput } from '@shared/schemas/auth';
import { Button, Field, Input } from '../components/ui';
import { ApiError } from '../lib/api';
import { useLogin, useSession } from '../services/queries';

interface FeatureTileProps {
  glyph: string;
  title: string;
  detail: string;
}

/** Celda bento en miniatura: describe una capacidad real del sistema, no una cifra inventada. */
function FeatureTile({ glyph, title, detail }: FeatureTileProps) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/5 p-3">
      <span aria-hidden="true" className="text-sm text-gold-500">
        {glyph}
      </span>
      <p className="mt-2 text-xs font-semibold text-white">{title}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-white/60">{detail}</p>
    </div>
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
    login.error instanceof ApiError ? login.error.message : login.error ? 'No se pudo iniciar sesion.' : null;

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
      {/* Panel de marca: solo en escritorio, describe capacidades reales del sistema. */}
      <div className="relative hidden overflow-hidden bg-brand-900 px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        <div className="relative">
          <div className="inline-flex rounded-2xl bg-white px-4 py-3">
            <img src="/logo.webp" alt="Zorzal Lirio OS" className="h-8 w-auto" />
          </div>

          <h1 className="mt-10 max-w-md text-3xl leading-tight font-bold text-balance">
            Control de produccion de uniformes, de principio a fin.
          </h1>
          <p className="mt-3 max-w-sm text-sm text-white/70">
            Un tablero, un responsable por etapa y un historial que nunca se pierde.
          </p>
        </div>

        <div className="relative grid grid-cols-2 gap-3">
          <FeatureTile glyph="◆" title="Tablero Kanban" detail="Etapas con responsable asignado" />
          <FeatureTile glyph="▲" title="SLA automatico" detail="Alertas antes de vencer, sin duplicados" />
          <FeatureTile glyph="●" title="Historial completo" detail="Cada movimiento queda registrado" />
          <FeatureTile glyph="■" title="Reportes" detail="Carga por persona y tiempos por etapa" />
        </div>
      </div>

      {/* Panel de formulario. */}
      <div className="flex items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
            <div className="rounded-2xl border-2 border-brand-900 bg-white px-6 py-4">
              <img src="/logo.webp" alt="Zorzal Lirio OS" className="h-8 w-auto" />
            </div>
            <p className="text-sm font-medium text-muted">Control de produccion de uniformes</p>
          </div>

          <form
            onSubmit={onSubmit}
            noValidate
            className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6 lg:border-0 lg:bg-transparent lg:p-0"
          >
            <div>
              <h2 className="text-xl font-semibold text-ink">Iniciar sesion</h2>
              <p className="mt-1 text-sm text-muted">Entra con tu correo y contrasena.</p>
            </div>

            {serverError ? (
              <p role="alert" className="rounded border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
                {serverError}
              </p>
            ) : null}

            <Field label="Correo" htmlFor="email" required error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                autoFocus
                aria-invalid={Boolean(errors.email)}
                {...register('email')}
              />
            </Field>

            <Field label="Contrasena" htmlFor="password" required error={errors.password?.message}>
              <div className="relative">
                <Input
                  id="password"
                  type={passwordVisible ? 'text' : 'password'}
                  autoComplete="current-password"
                  aria-invalid={Boolean(errors.password)}
                  className="pr-14"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setPasswordVisible((visible) => !visible)}
                  className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-muted hover:text-ink"
                  aria-label={passwordVisible ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                >
                  {passwordVisible ? 'Ocultar' : 'Ver'}
                </button>
              </div>
            </Field>

            <Button type="submit" className="mt-1 h-11" disabled={isSubmitting || login.isPending}>
              {login.isPending ? 'Entrando...' : 'Entrar'}
            </Button>

            <p className="text-center text-xs text-muted">
              ¿No tienes acceso? Pide a un administrador que te cree una cuenta en{' '}
              <span className="font-medium text-ink">Equipo</span>.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
