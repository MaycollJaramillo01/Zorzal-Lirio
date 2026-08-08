import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '../lib/format';

/* -------------------------------------------------------------- iconografia */

export type IconName =
  | 'dashboard'
  | 'orders'
  | 'team'
  | 'clock'
  | 'reports'
  | 'profile'
  | 'menu'
  | 'close'
  | 'arrow'
  | 'spark'
  | 'activity'
  | 'check';

const iconPaths: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="4" rx="1.5" />
      <rect x="14" y="11" width="7" height="10" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  orders: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="m3 6 1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2" />
    </>
  ),
  team: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  reports: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20V7" />
      <path d="M2 20h22" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  spark: <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm7 13 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" />,
  activity: <path d="M3 12h4l2.5-7 5 14 2.5-7h4" />,
  check: <path d="m5 12 4 4L19 6" />,
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4 shrink-0', className)}
    >
      {iconPaths[name]}
    </svg>
  );
}

/* ---------------------------------------------------------------- botones */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'border border-brand-900 bg-brand-900 text-white shadow-sm hover:-translate-y-0.5 hover:bg-brand-700',
  secondary: 'border border-line bg-surface text-ink hover:-translate-y-0.5 hover:border-brand-300 hover:bg-white',
  ghost: 'border border-transparent bg-transparent text-ink hover:bg-surface-muted',
  danger: 'border border-danger bg-danger text-white hover:-translate-y-0.5 hover:brightness-90',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold disabled:cursor-not-allowed disabled:opacity-50 disabled:transform-none',
        size === 'sm' ? 'min-h-8 px-3 py-1 text-xs' : 'min-h-10 px-4 py-2 text-sm',
        buttonStyles[variant],
        className,
      )}
      {...props}
    />
  );
});

/* ----------------------------------------------------------------- campos */

export interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | string[];
  required?: boolean;
  children: ReactNode;
}

export function Field({ label, htmlFor, hint, error, required, children }: FieldProps) {
  const messages = Array.isArray(error) ? error : error ? [error] : [];
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-semibold text-ink">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      {children}
      {hint && messages.length === 0 ? <p className="text-xs text-muted">{hint}</p> : null}
      {messages.map((message) => (
        <p key={message} className="text-xs font-medium text-danger">
          {message}
        </p>
      ))}
    </div>
  );
}

const controlClass =
  'min-h-10 w-full rounded-xl border border-line bg-white/80 px-3.5 py-2 text-sm text-ink shadow-[inset_0_1px_0_rgba(36,29,24,0.03)] placeholder:text-muted/65 hover:border-brand-300 focus:border-brand-700 focus:bg-white focus:outline-none disabled:bg-surface-muted';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(controlClass, className)} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 3, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={cn(controlClass, className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(controlClass, 'pr-8', className)} {...props}>
        {children}
      </select>
    );
  },
);

export function Checkbox({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId();
  return (
    <label htmlFor={props.id ?? id} className="inline-flex items-center gap-2 text-sm text-ink">
      <input
        id={props.id ?? id}
        type="checkbox"
        className="size-4 rounded border-line accent-[var(--brand-700)]"
        {...props}
      />
      {label}
    </label>
  );
}

/* ---------------------------------------------------------------- bloques */

type BentoTone = 'surface' | 'muted' | 'ink' | 'gold';

const bentoTones: Record<BentoTone, string> = {
  surface: 'border-line bg-surface text-ink',
  muted: 'border-line bg-surface-muted text-ink',
  ink: 'border-brand-900 bg-brand-900 text-white',
  gold: 'border-gold-500 bg-gold-500 text-brand-900',
};

export function BentoTile({
  children,
  className,
  tone = 'surface',
}: {
  children: ReactNode;
  className?: string;
  tone?: BentoTone;
}) {
  return (
    <section
      className={cn(
        'min-w-0 overflow-hidden rounded-[1.5rem] border shadow-[var(--shadow-tile)]',
        bentoTones[tone],
        className,
      )}
    >
      {children}
    </section>
  );
}

export function Card({
  title,
  actions,
  children,
  className,
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  // `min-w-0`: sin esto una celda de grid no baja de su ancho intrinseco y los
  // graficos de Recharts empujan la pagina fuera de la pantalla en moviles
  // angostos (320 px).
  return (
    <BentoTile className={className}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-1">
          {title ? <h2 className="text-base font-semibold text-ink">{title}</h2> : <span />}
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </BentoTile>
  );
}

/**
 * Celda de estilo bento: los tonos "ink" y "gold" se usan como bloques de
 * color solido (acento) entre celdas blancas, en vez de sombra o degradado.
 */
export function StatTile({
  label,
  value,
  detail,
  tone = 'neutral',
  className,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  tone?: 'neutral' | 'warning' | 'danger' | 'success' | 'ink' | 'gold';
  className?: string;
}) {
  const tones = {
    neutral: 'border-line bg-surface text-ink',
    warning: 'border-warning/30 bg-warning-soft text-ink',
    danger: 'border-danger/30 bg-danger-soft text-ink',
    success: 'border-success/30 bg-success-soft text-ink',
    ink: 'border-brand-900 bg-brand-900 text-white',
    gold: 'border-gold-500 bg-gold-500 text-brand-900',
  } as const;

  const labelTones = {
    neutral: 'text-muted',
    warning: 'text-warning',
    danger: 'text-danger',
    success: 'text-success',
    ink: 'text-white/65',
    gold: 'text-brand-900/70',
  } as const;

  const detailTones = {
    neutral: 'text-muted',
    warning: 'text-ink/70',
    danger: 'text-ink/70',
    success: 'text-ink/70',
    ink: 'text-white/70',
    gold: 'text-brand-900/70',
  } as const;

  return (
    <div
      className={cn(
        'group relative flex min-h-40 flex-col justify-between overflow-hidden rounded-[1.5rem] border p-5 shadow-[var(--shadow-tile)]',
        tones[tone],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="absolute -right-8 -bottom-10 size-28 rounded-full border border-current opacity-[0.08] transition-transform duration-500 group-hover:scale-110"
      />
      <p className={cn('relative text-xs font-semibold tracking-[0.08em]', labelTones[tone])}>{label}</p>
      <p className="relative mt-5 font-display text-4xl leading-none font-semibold tracking-[-0.05em] tabular-nums">{value}</p>
      {detail ? <p className={cn('relative mt-2 text-xs', detailTones[tone])}>{detail}</p> : null}
    </div>
  );
}

export function Spinner({ label = 'Cargando' }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-32 items-center justify-center gap-3 rounded-[1.5rem] border border-line bg-surface/70 text-sm font-medium text-muted">
      <span
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-2 border-line border-t-brand-700"
      />
      {label}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-300 bg-background/55 px-6 py-10 text-center">
      <span aria-hidden="true" className="mb-1 flex size-9 items-center justify-center rounded-xl bg-brand-soft text-brand-700">
        <Icon name="spark" />
      </span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? <p className="max-w-md text-sm text-muted">{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-danger/35 bg-danger-soft px-5 py-4">
      <p className="text-sm font-medium text-danger">{message}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      ) : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <p className="mb-1 text-[11px] font-bold tracking-[0.14em] text-brand-700 uppercase">Zorzal Lirio OS</p>
        <h1 className="text-3xl leading-none font-semibold text-ink sm:text-4xl">{title}</h1>
        {description ? <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

/* ----------------------------------------------------------------- modal */

export interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}

/**
 * Modal accesible sobre `<dialog>` nativo: aporta focus trap, cierre con Escape
 * y semantica de dialogo sin librerias adicionales.
 */
export function Modal({ open, title, description, onClose, children, footer, size = 'md' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
      }
    } else if (dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className={cn(
        'm-auto w-[calc(100vw-2rem)] rounded-[1.5rem] border border-line bg-surface p-0 text-ink shadow-[var(--shadow-float)] backdrop:bg-brand-900/55 backdrop:backdrop-blur-sm',
        size === 'lg' ? 'max-w-3xl' : 'max-w-lg',
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
        <div>
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          {description ? <p className="text-sm text-muted">{description}</p> : null}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar diálogo">
          <Icon name="close" />
        </Button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
      {footer ? (
        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>
      ) : null}
    </dialog>
  );
}

/* ---------------------------------------------------------------- avisos */

interface ToastMessage {
  id: number;
  tone: 'success' | 'error';
  text: string;
}

interface ToastContextValue {
  notify: (text: string, tone?: ToastMessage['tone']) => void;
}

const ToastContext = createContext<ToastContextValue>({ notify: () => undefined });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const notify = useCallback((text: string, tone: ToastMessage['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setMessages((current) => [...current, { id, tone, text }]);
    setTimeout(() => {
      setMessages((current) => current.filter((message) => message.id !== id));
    }, 6000);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        role="status"
        className="pointer-events-none fixed inset-x-3 bottom-3 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'pointer-events-auto max-w-sm rounded-xl border px-4 py-3 text-sm shadow-[var(--shadow-float)]',
              message.tone === 'error'
                ? 'border-danger/40 bg-danger-soft text-danger'
                : 'border-success/40 bg-success-soft text-success',
            )}
          >
            {message.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
