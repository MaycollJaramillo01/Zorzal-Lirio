import { z } from 'zod';

export const updateStageSlaSchema = z
  .object({
    isSlaEnabled: z.boolean(),
    slaMinutes: z.coerce.number().int().min(1).max(525_600).nullable(),
    warningBeforeMinutes: z.coerce.number().int().min(0).max(525_600).nullable(),
  })
  .refine((data) => !data.isSlaEnabled || data.slaMinutes !== null, {
    path: ['slaMinutes'],
    message: 'Define el tiempo permitido para activar el SLA.',
  })
  .refine(
    (data) =>
      data.slaMinutes === null ||
      data.warningBeforeMinutes === null ||
      data.warningBeforeMinutes <= data.slaMinutes,
    {
      path: ['warningBeforeMinutes'],
      message: 'La advertencia no puede ser mayor que el tiempo permitido.',
    },
  );

export type UpdateStageSlaInput = z.infer<typeof updateStageSlaSchema>;
