import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { loginSchema, type LoginInput } from '@shared/schemas/auth';
import { Button, Field, Input } from '../components/ui';
import { ApiError } from '../lib/api';
import { useLogin, useSession } from '../services/queries';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session, isPending } = useSession();
  const login = useLogin();

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
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex justify-center">
          <div className="rounded-2xl border-2 border-brand-900 bg-white px-6 py-4">
            <img src="/logo.webp" alt="Zorzal Lirio OS" className="h-9 w-auto" />
          </div>
        </div>
        <p className="mb-5 text-center text-sm font-medium text-muted">
          Control de produccion de uniformes
        </p>

        <form
          onSubmit={onSubmit}
          noValidate
          className="relative flex flex-col gap-4 rounded-2xl border-2 border-brand-900 bg-surface p-5"
        >
          <span aria-hidden="true" className="absolute top-0 right-6 h-2 w-10 rounded-b-full bg-gold-500" />
          <h2 className="text-base font-semibold text-ink">Iniciar sesion</h2>

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
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              {...register('password')}
            />
          </Field>

          <Button type="submit" disabled={isSubmitting || login.isPending}>
            {login.isPending ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  );
}
