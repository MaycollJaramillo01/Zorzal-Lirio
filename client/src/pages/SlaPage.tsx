import { useState } from 'react';
import { daysToMinutes, minutesToDays } from '@shared/lib/sla';
import type { StageDto } from '@shared/types/index';
import { Button, Card, Checkbox, ErrorState, Input, PageHeader, Spinner, useToast } from '../components/ui';
import { ApiError } from '../lib/api';
import { fmtDuration } from '../lib/format';
import { useStages, useUpdateStageSla } from '../services/queries';

interface DraftValue {
  isSlaEnabled: boolean;
  slaDays: string;
  warningDays: string;
}

export function SlaPage() {
  const stagesQuery = useStages();
  const updateSla = useUpdateStageSla();
  const { notify } = useToast();
  const [drafts, setDrafts] = useState<Record<string, DraftValue>>({});

  if (stagesQuery.isPending) return <Spinner label="Cargando etapas" />;
  if (stagesQuery.isError) {
    return <ErrorState message="No se pudieron cargar las etapas." onRetry={() => void stagesQuery.refetch()} />;
  }

  const stages = stagesQuery.data ?? [];

  const draftFor = (stage: StageDto): DraftValue =>
    drafts[stage.id] ?? {
      isSlaEnabled: stage.isSlaEnabled,
      slaDays: String(minutesToDays(stage.slaMinutes) ?? ''),
      warningDays: String(minutesToDays(stage.warningBeforeMinutes) ?? ''),
    };

  const setDraft = (stageId: string, patch: Partial<DraftValue>) => {
    setDrafts((current) => {
      const stage = stages.find((item) => item.id === stageId)!;
      const base = current[stageId] ?? {
        isSlaEnabled: stage.isSlaEnabled,
        slaDays: String(minutesToDays(stage.slaMinutes) ?? ''),
        warningDays: String(minutesToDays(stage.warningBeforeMinutes) ?? ''),
      };
      return { ...current, [stageId]: { ...base, ...patch } };
    });
  };

  const save = async (stage: StageDto) => {
    const draft = draftFor(stage);
    const slaDays = draft.slaDays === '' ? null : Number(draft.slaDays);
    const warningDays = draft.warningDays === '' ? null : Number(draft.warningDays);

    if (draft.isSlaEnabled && (slaDays === null || Number.isNaN(slaDays) || slaDays <= 0)) {
      notify('Escribe un tiempo permitido mayor a cero.', 'error');
      return;
    }

    try {
      await updateSla.mutateAsync({
        stageId: stage.id,
        isSlaEnabled: draft.isSlaEnabled,
        slaMinutes: daysToMinutes(slaDays),
        warningBeforeMinutes: daysToMinutes(warningDays),
      });
      setDrafts((current) => {
        const next = { ...current };
        delete next[stage.id];
        return next;
      });
      notify(`SLA de ${stage.name} actualizado.`);
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'No se pudo guardar el SLA.', 'error');
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title="SLA por etapa"
        description="Los valores se escriben en dias y se almacenan internamente en minutos."
      />

      <Card>
        <div className="zl-scroll overflow-x-auto">
          <table className="w-full min-w-[48rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
                <th className="py-2 pr-3">Etapa</th>
                <th className="py-2 pr-3">SLA activo</th>
                <th className="py-2 pr-3">Tiempo permitido (dias)</th>
                <th className="py-2 pr-3">Advertencia antes (dias)</th>
                <th className="py-2 pr-3">Equivalente</th>
                <th className="py-2">Accion</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((stage) => {
                const draft = draftFor(stage);
                const dirty = Boolean(drafts[stage.id]);
                return (
                  <tr key={stage.id} className="border-b border-line/60">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-ink">
                        {stage.position}. {stage.name}
                      </p>
                      <p className="text-xs text-muted">{stage.code}</p>
                    </td>
                    <td className="py-2 pr-3">
                      <Checkbox
                        label="Activo"
                        checked={draft.isSlaEnabled}
                        onChange={(event) => setDraft(stage.id, { isSlaEnabled: event.target.checked })}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        className="w-28"
                        aria-label={`Tiempo permitido en dias para ${stage.name}`}
                        value={draft.slaDays}
                        disabled={!draft.isSlaEnabled}
                        onChange={(event) => setDraft(stage.id, { slaDays: event.target.value })}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        className="w-28"
                        aria-label={`Dias de advertencia para ${stage.name}`}
                        value={draft.warningDays}
                        disabled={!draft.isSlaEnabled}
                        onChange={(event) => setDraft(stage.id, { warningDays: event.target.value })}
                      />
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted">
                      {stage.isSlaEnabled && stage.slaMinutes
                        ? `${fmtDuration(stage.slaMinutes)} (aviso ${fmtDuration(stage.warningBeforeMinutes ?? 0)} antes)`
                        : 'Sin SLA'}
                    </td>
                    <td className="py-2">
                      <Button size="sm" disabled={!dirty || updateSla.isPending} onClick={() => void save(stage)}>
                        Guardar
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
