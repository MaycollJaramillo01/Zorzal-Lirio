import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { ROLE_LABELS } from '@shared/constants/enums';
import { changePasswordSchema, type ChangePasswordInput } from '@shared/schemas/auth';
import { Button, Card, Field, Input, PageHeader, useToast } from '../components/ui';
import { ApiError } from '../lib/api';
import { fmtDateTime } from '../lib/format';
import { useChangePassword, useSession } from '../services/queries';

export function ProfilePage() {
  const { data: session } = useSession();
  const changePassword = useChangePassword();
  const { notify } = useToast();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  if (!session) return null;

  const submit = handleSubmit(async (values) => {
    try {
      await changePassword.mutateAsync(values);
      notify('Contrasena actualizada. Inicia sesion nuevamente.');
      window.location.assign('/login');
    } catch (error) {
      setError('root', {
        message: error instanceof ApiError ? error.message : 'No se pudo cambiar la contrasena.',
      });
    }
  });

  return (
    <div className="flex min-w-0 max-w-4xl flex-col gap-5">
      <PageHeader title="Perfil" description="Datos de tu cuenta y cambio de contrasena." />

      {session.mustChangePassword ? (
        <p role="alert" className="rounded-2xl border border-warning/40 bg-warning-soft px-5 py-4 text-sm font-medium text-warning">
          Debes cambiar tu contrasena inicial antes de usar el sistema.
        </p>
      ) : null}

      <Card title="Mi cuenta">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold tracking-wide text-muted uppercase">Nombre</dt>
            <dd className="text-sm text-ink">{session.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-muted uppercase">Correo</dt>
            <dd className="text-sm text-ink">{session.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-muted uppercase">Rol</dt>
            <dd className="text-sm text-ink">{ROLE_LABELS[session.role]}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-muted uppercase">Ultimo acceso</dt>
            <dd className="text-sm text-ink">
              {session.lastLoginAt ? fmtDateTime(session.lastLoginAt) : 'Este es tu primer acceso'}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold tracking-wide text-muted uppercase">Etapas de enfoque</dt>
            <dd className="text-sm text-ink">
              {session.stageFocus.length === 0
                ? 'Sin etapas asignadas'
                : session.stageFocus.map((stage) => stage.name).join(', ')}
            </dd>
          </div>
        </dl>
      </Card>

      <Card title="Cambiar contrasena">
        <form onSubmit={submit} noValidate className="flex max-w-md flex-col gap-3">
          {errors.root ? (
            <p role="alert" className="rounded border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
              {errors.root.message}
            </p>
          ) : null}

          <Field label="Contrasena actual" htmlFor="actual" required error={errors.currentPassword?.message}>
            <Input id="actual" type="password" autoComplete="current-password" {...register('currentPassword')} />
          </Field>
          <Field
            label="Nueva contrasena"
            htmlFor="nueva"
            required
            hint="Minimo 8 caracteres."
            error={errors.newPassword?.message}
          >
            <Input id="nueva" type="password" autoComplete="new-password" {...register('newPassword')} />
          </Field>
          <Field label="Repetir nueva contrasena" htmlFor="repetir" required error={errors.confirmPassword?.message}>
            <Input id="repetir" type="password" autoComplete="new-password" {...register('confirmPassword')} />
          </Field>

          <div>
            <Button type="submit" disabled={isSubmitting || changePassword.isPending}>
              {changePassword.isPending ? 'Guardando...' : 'Cambiar contrasena'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
