import { useState } from 'react';
import { ROLES, ROLE_LABELS, type Role } from '@shared/constants/enums';
import type { StageDto, TeamMember } from '@shared/types/index';
import { Avatar, RoleBadge } from '../components/indicators';
import {
  Button,
  Card,
  Checkbox,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  useToast,
} from '../components/ui';
import { ApiError } from '../lib/api';
import { fmtDateTime } from '../lib/format';
import { useSession, useStages, useTeamMutations, useUsers } from '../services/queries';

export function TeamPage() {
  const { data: session } = useSession();
  const usersQuery = useUsers();
  const stagesQuery = useStages();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [focusing, setFocusing] = useState<TeamMember | null>(null);
  const [resetting, setResetting] = useState<TeamMember | null>(null);

  if (!session) return null;
  if (usersQuery.isPending) return <Spinner label="Cargando equipo" />;
  if (usersQuery.isError) {
    return <ErrorState message="No se pudo cargar el equipo." onRetry={() => void usersQuery.refetch()} />;
  }

  const members = (usersQuery.data ?? []) as TeamMember[];
  const stages: StageDto[] = stagesQuery.data ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title="Equipo"
        description="Usuarios internos y talleres externos con acceso al sistema."
        actions={<Button onClick={() => setCreateOpen(true)}>Nuevo usuario</Button>}
      />

      <Card>
        <div className="zl-scroll overflow-x-auto">
          <table className="w-full min-w-[64rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
                <th className="py-2 pr-3">Usuario</th>
                <th className="py-2 pr-3">Rol</th>
                <th className="py-2 pr-3">WhatsApp</th>
                <th className="py-2 pr-3">Etapas de enfoque</th>
                <th className="py-2 pr-3">Asignadas</th>
                <th className="py-2 pr-3">Atrasadas</th>
                <th className="py-2 pr-3">Ultimo acceso</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b border-line/60 align-top">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <Avatar user={member} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{member.name}</p>
                        <p className="truncate text-xs text-muted">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <RoleBadge role={member.role} />
                    {member.isPrimaryOwner ? (
                      <p className="mt-1 text-[11px] text-muted">Dueno principal</p>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    {member.whatsappPhone ? (
                      <>
                        <p className="font-medium text-ink">{member.whatsappPhone}</p>
                        <p className={member.whatsappNotificationsEnabled ? 'text-success' : 'text-muted'}>
                          {member.whatsappNotificationsEnabled ? 'Alertas activas' : 'Alertas desactivadas'}
                        </p>
                      </>
                    ) : (
                      <span className="text-muted">Sin configurar</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-xs text-muted">
                    {member.stageFocus.length === 0
                      ? 'Sin etapas'
                      : member.stageFocus.map((stage) => stage.name).join(', ')}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{member.activeOrders}</td>
                  <td className="py-2 pr-3 tabular-nums text-danger">{member.overdueOrders}</td>
                  <td className="py-2 pr-3 text-xs text-muted">
                    {member.lastLoginAt ? fmtDateTime(member.lastLoginAt) : 'Nunca'}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={
                        member.isActive
                          ? 'rounded border border-success/40 bg-success-soft px-1.5 py-0.5 text-xs text-success'
                          : 'rounded border border-line bg-surface-muted px-1.5 py-0.5 text-xs text-muted'
                      }
                    >
                      {member.isActive ? 'Activo' : 'Desactivado'}
                    </span>
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="secondary" onClick={() => setEditing(member)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setFocusing(member)}>
                        Etapas
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setResetting(member)}>
                        Contrasena
                      </Button>
                      <ToggleActiveButton member={member} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <CreateUserModal open={createOpen} stages={stages} onClose={() => setCreateOpen(false)} />
      <EditUserModal member={editing} onClose={() => setEditing(null)} />
      <StageFocusModal member={focusing} stages={stages} onClose={() => setFocusing(null)} />
      <ResetPasswordModal member={resetting} onClose={() => setResetting(null)} />
    </div>
  );
}

function ToggleActiveButton({ member }: { member: TeamMember }) {
  const { setActive } = useTeamMutations();
  const { notify } = useToast();

  return (
    <Button
      size="sm"
      variant={member.isActive ? 'danger' : 'primary'}
      disabled={member.isPrimaryOwner || setActive.isPending}
      title={member.isPrimaryOwner ? 'El dueno principal no puede desactivarse.' : undefined}
      onClick={async () => {
        try {
          await setActive.mutateAsync({ id: member.id, isActive: !member.isActive });
          notify(member.isActive ? 'Usuario desactivado.' : 'Usuario activado.');
        } catch (error) {
          notify(error instanceof ApiError ? error.message : 'No se pudo cambiar el estado.', 'error');
        }
      }}
    >
      {member.isActive ? 'Desactivar' : 'Activar'}
    </Button>
  );
}

function CreateUserModal({
  open,
  stages,
  onClose,
}: {
  open: boolean;
  stages: StageDto[];
  onClose: () => void;
}) {
  const { createUser } = useTeamMutations();
  const { notify } = useToast();
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'PLANT' as Role,
    password: '',
    mustChangePassword: true,
    whatsappPhone: '',
    whatsappNotificationsEnabled: false,
  });
  const [stageIds, setStageIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const submit = async () => {
    setError(null);
    try {
      await createUser.mutateAsync({
        ...form,
        whatsappPhone: form.whatsappPhone || null,
        stageIds,
      });
      notify('Usuario creado.');
      setForm({
        name: '',
        email: '',
        role: 'PLANT',
        password: '',
        mustChangePassword: true,
        whatsappPhone: '',
        whatsappNotificationsEnabled: false,
      });
      setStageIds([]);
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No se pudo crear el usuario.');
    }
  };

  return (
    <Modal
      open
      title="Nuevo usuario"
      description="Los talleres externos se registran con rol Planta."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={createUser.isPending}>
            Crear usuario
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error ? (
          <p role="alert" className="rounded border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <Field label="Nombre" htmlFor="nuevo-nombre" required>
          <Input
            id="nuevo-nombre"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </Field>
        <Field label="Correo" htmlFor="nuevo-correo" required>
          <Input
            id="nuevo-correo"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        </Field>
        <Field label="Rol" htmlFor="nuevo-rol" required>
          <Select
            id="nuevo-rol"
            value={form.role}
            onChange={(event) => setForm({ ...form, role: event.target.value as Role })}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Contrasena inicial" htmlFor="nueva-contrasena" required hint="Minimo 8 caracteres.">
          <Input
            id="nueva-contrasena"
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
        </Field>
        <Checkbox
          label="Exigir cambio de contrasena en el primer acceso"
          checked={form.mustChangePassword}
          onChange={(event) => setForm({ ...form, mustChangePassword: event.target.checked })}
        />
        <Field
          label="WhatsApp interno"
          htmlFor="nuevo-whatsapp"
          hint="Numero del usuario de Zorzal Lirio OS en formato +504..."
        >
          <Input
            id="nuevo-whatsapp"
            type="tel"
            placeholder="+50488328459"
            value={form.whatsappPhone}
            onChange={(event) => {
              const whatsappPhone = event.target.value;
              setForm({
                ...form,
                whatsappPhone,
                whatsappNotificationsEnabled:
                  whatsappPhone.trim() === '' ? false : form.whatsappNotificationsEnabled,
              });
            }}
          />
        </Field>
        <Checkbox
          label="Enviar alertas operativas por WhatsApp"
          checked={form.whatsappNotificationsEnabled}
          disabled={!form.whatsappPhone.trim()}
          onChange={(event) =>
            setForm({ ...form, whatsappNotificationsEnabled: event.target.checked })
          }
        />
        <StageFocusPicker stages={stages} selected={stageIds} onChange={setStageIds} />
      </div>
    </Modal>
  );
}

function EditUserModal({ member, onClose }: { member: TeamMember | null; onClose: () => void }) {
  const { updateUser } = useTeamMutations();
  const { notify } = useToast();
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'PLANT' as Role,
    whatsappPhone: '',
    whatsappNotificationsEnabled: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  if (!member) return null;

  if (loadedId !== member.id) {
    setLoadedId(member.id);
    setForm({
      name: member.name,
      email: member.email,
      role: member.role,
      whatsappPhone: member.whatsappPhone ?? '',
      whatsappNotificationsEnabled: member.whatsappNotificationsEnabled,
    });
  }

  const submit = async () => {
    setError(null);
    try {
      await updateUser.mutateAsync({
        id: member.id,
        ...form,
        whatsappPhone: form.whatsappPhone || null,
      });
      notify('Usuario actualizado.');
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No se pudo actualizar el usuario.');
    }
  };

  return (
    <Modal
      open
      title={`Editar ${member.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={updateUser.isPending}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error ? (
          <p role="alert" className="rounded border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <Field label="Nombre" htmlFor="editar-nombre">
          <Input
            id="editar-nombre"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </Field>
        <Field label="Correo" htmlFor="editar-correo">
          <Input
            id="editar-correo"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        </Field>
        <Field label="Rol" htmlFor="editar-rol">
          <Select
            id="editar-rol"
            value={form.role}
            disabled={member.isPrimaryOwner}
            onChange={(event) => setForm({ ...form, role: event.target.value as Role })}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="WhatsApp interno"
          htmlFor="editar-whatsapp"
          hint="Debe existir como contacto en la subcuenta conectada de HighLevel."
        >
          <Input
            id="editar-whatsapp"
            type="tel"
            placeholder="+50488328459"
            value={form.whatsappPhone}
            onChange={(event) => {
              const whatsappPhone = event.target.value;
              setForm({
                ...form,
                whatsappPhone,
                whatsappNotificationsEnabled:
                  whatsappPhone.trim() === '' ? false : form.whatsappNotificationsEnabled,
              });
            }}
          />
        </Field>
        <Checkbox
          label="Enviar alertas operativas por WhatsApp"
          checked={form.whatsappNotificationsEnabled}
          disabled={!form.whatsappPhone.trim()}
          onChange={(event) =>
            setForm({ ...form, whatsappNotificationsEnabled: event.target.checked })
          }
        />
      </div>
    </Modal>
  );
}

function StageFocusModal({
  member,
  stages,
  onClose,
}: {
  member: TeamMember | null;
  stages: StageDto[];
  onClose: () => void;
}) {
  const { setStageFocus } = useTeamMutations();
  const { notify } = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  if (!member) return null;

  if (loadedId !== member.id) {
    setLoadedId(member.id);
    setSelected(member.stageFocus.map((stage) => stage.id));
  }

  return (
    <Modal
      open
      title={`Etapas de enfoque de ${member.name}`}
      description="Determinan que ordenes vera un usuario de planta."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={setStageFocus.isPending}
            onClick={async () => {
              await setStageFocus.mutateAsync({ id: member.id, stageIds: selected });
              notify('Etapas de enfoque actualizadas.');
              onClose();
            }}
          >
            Guardar
          </Button>
        </>
      }
    >
      <StageFocusPicker stages={stages} selected={selected} onChange={setSelected} />
    </Modal>
  );
}

function StageFocusPicker({
  stages,
  selected,
  onChange,
}: {
  stages: StageDto[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xs font-semibold tracking-wide text-muted uppercase">
        Etapas de enfoque
      </legend>
      {stages.map((stage) => (
        <Checkbox
          key={stage.id}
          label={stage.name}
          checked={selected.includes(stage.id)}
          onChange={(event) =>
            onChange(
              event.target.checked
                ? [...selected, stage.id]
                : selected.filter((id) => id !== stage.id),
            )
          }
        />
      ))}
    </fieldset>
  );
}

function ResetPasswordModal({ member, onClose }: { member: TeamMember | null; onClose: () => void }) {
  const { resetPassword } = useTeamMutations();
  const { notify } = useToast();
  const [password, setPassword] = useState('');
  const [mustChange, setMustChange] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!member) return null;

  return (
    <Modal
      open
      title={`Restablecer contrasena de ${member.name}`}
      description="Se cerraran todas sus sesiones abiertas."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={resetPassword.isPending}
            onClick={async () => {
              setError(null);
              try {
                await resetPassword.mutateAsync({
                  id: member.id,
                  newPassword: password,
                  mustChangePassword: mustChange,
                });
                notify('Contrasena restablecida.');
                setPassword('');
                onClose();
              } catch (caught) {
                setError(
                  caught instanceof ApiError ? caught.message : 'No se pudo restablecer la contrasena.',
                );
              }
            }}
          >
            Restablecer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error ? (
          <p role="alert" className="rounded border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <Field label="Nueva contrasena" htmlFor="reset-password" required hint="Minimo 8 caracteres.">
          <Input
            id="reset-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Checkbox
          label="Exigir cambio en el proximo acceso"
          checked={mustChange}
          onChange={(event) => setMustChange(event.target.checked)}
        />
      </div>
    </Modal>
  );
}
