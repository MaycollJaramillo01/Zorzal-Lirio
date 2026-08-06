import { useEffect, useMemo, useState } from 'react';
import { evaluateTransition, transitionRequiresAssignee } from '@shared/lib/transitions';
import type { Role } from '@shared/constants/enums';
import type { OrderCard, StageDto, UserRef } from '@shared/types/index';
import { Button, Field, Modal, Select, Textarea } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { useOrderMutations } from '../../services/queries';
import { useToast } from '../../components/ui';

export interface TransitionModalProps {
  order: OrderCard | null;
  targetStage: StageDto | null;
  stages: StageDto[];
  users: UserRef[];
  role: Role;
  onClose: () => void;
  onStageChange: (stageId: string) => void;
}

/**
 * Confirmacion obligatoria de todo movimiento. La base de datos solo se toca
 * cuando el usuario confirma; hasta entonces la tarjeta no cambia de columna.
 */
export function TransitionModal({
  order,
  targetStage,
  stages,
  users,
  role,
  onClose,
  onStageChange,
}: TransitionModalProps) {
  const { transitionOrder } = useOrderMutations();
  const { notify } = useToast();
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Al cambiar de orden o de etapa destino el formulario vuelve a su estado base.
  const currentAssigneeId = order?.assignee?.id ?? '';
  useEffect(() => {
    setAssigneeId(currentAssigneeId);
    setNote('');
    setReason('');
    setFormError(null);
  }, [order?.id, targetStage?.id, currentAssigneeId]);

  const evaluation = useMemo(() => {
    if (!order || !targetStage) return null;
    return evaluateTransition(role, order.stage.position, targetStage.position);
  }, [order, targetStage, role]);

  if (!order || !targetStage || !evaluation) return null;

  const needsAssignee = transitionRequiresAssignee(targetStage.code);
  const allowedStages = stages.filter(
    (stage) => evaluateTransition(role, order.stage.position, stage.position).allowed,
  );

  const submit = async () => {
    setFormError(null);

    if (!evaluation.allowed) {
      setFormError(evaluation.reason ?? 'El movimiento no esta permitido.');
      return;
    }
    if (needsAssignee && !assigneeId) {
      setFormError('Debes seleccionar un responsable para la nueva etapa.');
      return;
    }
    if (evaluation.requiresReason && reason.trim().length === 0) {
      setFormError('Debes escribir la razon de este movimiento.');
      return;
    }

    try {
      await transitionOrder.mutateAsync({
        id: order.id,
        version: order.version,
        toStageId: targetStage.id,
        assigneeId: assigneeId || null,
        note: note.trim() || undefined,
        reason: reason.trim() || undefined,
      });
      notify(`${order.orderCode} movida a ${targetStage.name}.`);
      onClose();
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.code === 'ORDER_VERSION_CONFLICT'
            ? 'La orden fue modificada por otro usuario. Se recargaran los datos.'
            : error.message
          : 'No se pudo mover la orden.';
      setFormError(message);
      notify(message, 'error');
    }
  };

  return (
    <Modal
      open
      title="Confirmar movimiento"
      description={`${order.orderCode} · ${order.customerName}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={transitionOrder.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={transitionOrder.isPending}>
            {transitionOrder.isPending ? 'Guardando...' : 'Confirmar movimiento'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {formError ? (
          <p role="alert" className="rounded border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        ) : null}

        <dl className="grid grid-cols-2 gap-3 rounded border border-line bg-surface-muted p-3 text-sm">
          <div>
            <dt className="text-xs text-muted">Pedido</dt>
            <dd className="font-medium text-ink">{order.projectName}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Responsable actual</dt>
            <dd className="font-medium text-ink">{order.assignee?.name ?? 'Sin asignar'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Etapa anterior</dt>
            <dd className="font-medium text-ink">{order.stage.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Etapa nueva</dt>
            <dd className="font-medium text-brand-700">{targetStage.name}</dd>
          </div>
        </dl>

        <Field label="Etapa destino" htmlFor="transicion-etapa">
          <Select
            id="transicion-etapa"
            value={targetStage.id}
            onChange={(event) => onStageChange(event.target.value)}
          >
            {allowedStages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.position}. {stage.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Nuevo responsable"
          htmlFor="transicion-responsable"
          required={needsAssignee}
          hint={needsAssignee ? undefined : 'La etapa Cerrado no requiere responsable.'}
        >
          <Select
            id="transicion-responsable"
            value={assigneeId}
            onChange={(event) => setAssigneeId(event.target.value)}
          >
            <option value="">Sin responsable</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </Select>
        </Field>

        {evaluation.requiresReason ? (
          <Field
            label={evaluation.kind === 'BACKWARD' ? 'Razon del retroceso' : 'Razon del salto de etapa'}
            htmlFor="transicion-razon"
            required
          >
            <Textarea
              id="transicion-razon"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explica por que se corrige el flujo normal"
            />
          </Field>
        ) : null}

        <Field label="Nota (opcional)" htmlFor="transicion-nota">
          <Textarea
            id="transicion-nota"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Detalle visible en el historial de la orden"
          />
        </Field>
      </div>
    </Modal>
  );
}
