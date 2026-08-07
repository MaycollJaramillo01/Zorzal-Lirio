export const MINUTES_PER_DAY = 1440;

export const STAGE_CODES = [
  'ORDER_RECEIVED',
  'FABRIC_PURCHASE',
  'WORKSHOP',
  'EMBROIDERY',
  'SHIPPING',
  'COLLECTION',
  'CLOSED',
] as const;

export type StageCode = (typeof STAGE_CODES)[number];

export const CLOSED_STAGE_CODE: StageCode = 'CLOSED';
export const FIRST_STAGE_CODE: StageCode = 'ORDER_RECEIVED';

export interface StageDefinition {
  code: StageCode;
  name: string;
  position: number;
  slaMinutes: number | null;
  warningBeforeMinutes: number | null;
  isSlaEnabled: boolean;
}

/** Configuracion inicial de etapas. Editable despues desde la seccion SLA. */
export const STAGE_DEFINITIONS: readonly StageDefinition[] = [
  {
    code: 'ORDER_RECEIVED',
    name: 'Orden recibida',
    position: 1,
    slaMinutes: 1 * MINUTES_PER_DAY,
    // Media jornada de aviso. Con un aviso igual al SLA la etapa nacia siempre
    // en "Proximo a vencer" y el estado "En tiempo" era inalcanzable.
    warningBeforeMinutes: MINUTES_PER_DAY / 2,
    isSlaEnabled: true,
  },
  {
    code: 'FABRIC_PURCHASE',
    name: 'Compra de tela',
    position: 2,
    slaMinutes: 5 * MINUTES_PER_DAY,
    warningBeforeMinutes: 1 * MINUTES_PER_DAY,
    isSlaEnabled: true,
  },
  {
    code: 'WORKSHOP',
    name: 'En taller',
    position: 3,
    slaMinutes: 10 * MINUTES_PER_DAY,
    warningBeforeMinutes: 1 * MINUTES_PER_DAY,
    isSlaEnabled: true,
  },
  {
    code: 'EMBROIDERY',
    name: 'Bordado',
    position: 4,
    slaMinutes: 5 * MINUTES_PER_DAY,
    warningBeforeMinutes: 1 * MINUTES_PER_DAY,
    isSlaEnabled: true,
  },
  {
    code: 'SHIPPING',
    name: 'Envio',
    position: 5,
    slaMinutes: 2 * MINUTES_PER_DAY,
    warningBeforeMinutes: 1 * MINUTES_PER_DAY,
    isSlaEnabled: true,
  },
  {
    code: 'COLLECTION',
    name: 'Cobro',
    position: 6,
    slaMinutes: 7 * MINUTES_PER_DAY,
    warningBeforeMinutes: 1 * MINUTES_PER_DAY,
    isSlaEnabled: true,
  },
  {
    code: 'CLOSED',
    name: 'Cerrado',
    position: 7,
    slaMinutes: null,
    warningBeforeMinutes: null,
    isSlaEnabled: false,
  },
];

export const STAGE_NAME_BY_CODE: Record<StageCode, string> = STAGE_DEFINITIONS.reduce(
  (acc, stage) => {
    acc[stage.code] = stage.name;
    return acc;
  },
  {} as Record<StageCode, string>,
);
