import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { PRIORITIES, PRIORITY_LABELS } from '@shared/constants/enums';
import {
  createOrderSchema,
  type CreateOrderFormValues,
  type CreateOrderInput,
} from '@shared/schemas/orders';
import type { OrderDetail, UserRef } from '@shared/types/index';
import { Button, Field, Input, Modal, Select, Textarea, useToast } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { todayCalendarDate } from '../../lib/format';
import { useOrderMutations } from '../../services/queries';

export interface OrderCreateModalProps {
  open: boolean;
  users: UserRef[];
  onClose: () => void;
  onCreated?: (order: OrderDetail) => void;
}

export function OrderCreateModal({ open, users, onClose, onCreated }: OrderCreateModalProps) {
  const { createOrder } = useOrderMutations();
  const { notify } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CreateOrderFormValues, unknown, CreateOrderInput>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      purchaseOrderNumber: '',
      customerName: '',
      projectName: '',
      description: '',
      quantity: 1,
      priority: 'NORMAL',
      purchaseOrderDate: todayCalendarDate(),
      expectedDeliveryDate: '',
      initialAssigneeId: '',
      initialNote: '',
    },
  });

  const submit = handleSubmit(async (values) => {
    try {
      const order = await createOrder.mutateAsync(values as unknown as Record<string, unknown>);
      notify(`Orden ${order.orderCode} creada.`);
      reset();
      onCreated?.(order);
      onClose();
    } catch (error) {
      if (error instanceof ApiError) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          setError(field as keyof CreateOrderInput, { message: messages[0] });
        }
        setError('root', { message: error.message });
      } else {
        setError('root', { message: 'No se pudo crear la orden.' });
      }
    }
  });

  if (!open) return null;

  return (
    <Modal
      open
      size="lg"
      title="Nueva orden de produccion"
      description="El codigo interno se genera automaticamente."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={createOrder.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={createOrder.isPending}>
            {createOrder.isPending ? 'Creando...' : 'Crear orden'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {errors.root ? (
          <p role="alert" className="sm:col-span-2 rounded border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
            {errors.root.message}
          </p>
        ) : null}

        <Field label="Numero de orden de compra" htmlFor="oc" required error={errors.purchaseOrderNumber?.message}>
          <Input id="oc" autoFocus {...register('purchaseOrderNumber')} />
        </Field>

        <Field label="Cliente" htmlFor="cliente" required error={errors.customerName?.message}>
          <Input id="cliente" {...register('customerName')} />
        </Field>

        <Field label="Proyecto" htmlFor="proyecto" required error={errors.projectName?.message}>
          <Input id="proyecto" {...register('projectName')} />
        </Field>

        <Field label="Cantidad" htmlFor="cantidad" required error={errors.quantity?.message}>
          <Input id="cantidad" type="number" min={1} {...register('quantity')} />
        </Field>

        <Field
          label="Fecha de recepcion de la OC"
          htmlFor="fecha-oc"
          required
          hint="Desde esta fecha corre el SLA de Orden recibida."
          error={errors.purchaseOrderDate?.message}
        >
          <Input id="fecha-oc" type="date" {...register('purchaseOrderDate')} />
        </Field>

        <Field label="Fecha esperada de entrega" htmlFor="fecha-entrega" error={errors.expectedDeliveryDate?.message}>
          <Input id="fecha-entrega" type="date" {...register('expectedDeliveryDate')} />
        </Field>

        <Field label="Responsable inicial" htmlFor="responsable" required error={errors.initialAssigneeId?.message}>
          <Select id="responsable" {...register('initialAssigneeId')}>
            <option value="">Selecciona un responsable</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Prioridad" htmlFor="prioridad" error={errors.priority?.message}>
          <Select id="prioridad" {...register('priority')}>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </Select>
        </Field>

        <div className="sm:col-span-2">
          <Field label="Descripcion" htmlFor="descripcion" error={errors.description?.message}>
            <Textarea id="descripcion" {...register('description')} />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="Nota inicial" htmlFor="nota-inicial" error={errors.initialNote?.message}>
            <Textarea id="nota-inicial" rows={2} {...register('initialNote')} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

export interface OrderEditModalProps {
  order: OrderDetail | null;
  onClose: () => void;
}

export function OrderEditModal({ order, onClose }: OrderEditModalProps) {
  const { updateOrder } = useOrderMutations();
  const { notify } = useToast();

  const { register, handleSubmit, setError, formState } = useForm({
    defaultValues: {
      purchaseOrderNumber: order?.purchaseOrderNumber ?? '',
      customerName: order?.customerName ?? '',
      projectName: order?.projectName ?? '',
      description: order?.description ?? '',
      quantity: order?.quantity ?? 1,
      priority: order?.priority ?? 'NORMAL',
      purchaseOrderDate: order?.purchaseOrderDate ?? todayCalendarDate(),
      expectedDeliveryDate: order?.expectedDeliveryDate ?? '',
    },
  });

  if (!order) return null;

  const submit = handleSubmit(async (values) => {
    try {
      await updateOrder.mutateAsync({
        id: order.id,
        version: order.version,
        ...values,
        quantity: Number(values.quantity),
        description: values.description || null,
        expectedDeliveryDate: values.expectedDeliveryDate || null,
      });
      notify(`Orden ${order.orderCode} actualizada.`);
      onClose();
    } catch (error) {
      setError('root', {
        message:
          error instanceof ApiError
            ? error.message
            : 'No se pudo actualizar la orden.',
      });
    }
  });

  return (
    <Modal
      open
      size="lg"
      title={`Editar ${order.orderCode}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={updateOrder.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={updateOrder.isPending}>
            {updateOrder.isPending ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {formState.errors.root ? (
          <p role="alert" className="sm:col-span-2 rounded border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
            {formState.errors.root.message}
          </p>
        ) : null}

        <Field label="Numero de orden de compra" htmlFor="edit-oc">
          <Input id="edit-oc" {...register('purchaseOrderNumber')} />
        </Field>
        <Field label="Cliente" htmlFor="edit-cliente">
          <Input id="edit-cliente" {...register('customerName')} />
        </Field>
        <Field label="Proyecto" htmlFor="edit-proyecto">
          <Input id="edit-proyecto" {...register('projectName')} />
        </Field>
        <Field label="Cantidad" htmlFor="edit-cantidad">
          <Input id="edit-cantidad" type="number" min={1} {...register('quantity')} />
        </Field>
        <Field label="Fecha de la OC" htmlFor="edit-fecha-oc">
          <Input id="edit-fecha-oc" type="date" {...register('purchaseOrderDate')} />
        </Field>
        <Field label="Fecha esperada de entrega" htmlFor="edit-fecha-entrega">
          <Input id="edit-fecha-entrega" type="date" {...register('expectedDeliveryDate')} />
        </Field>
        <Field label="Prioridad" htmlFor="edit-prioridad">
          <Select id="edit-prioridad" {...register('priority')}>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Descripcion" htmlFor="edit-descripcion">
            <Textarea id="edit-descripcion" {...register('description')} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
