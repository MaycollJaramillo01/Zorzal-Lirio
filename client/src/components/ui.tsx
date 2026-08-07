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

/* ---------------------------------------------------------------- botones */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-brand-900 text-white hover:bg-brand-700 disabled:bg-brand-500',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-muted',
  ghost: 'bg-transparent text-ink hover:bg-surface-muted',
  danger: 'bg-danger text-white hover:brightness-90',
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
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm',
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
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-xs font-semibold tracking-wide text-muted uppercase">
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
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/70 disabled:bg-surface-muted';

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
    <section className={cn('min-w-0 rounded-2xl border border-line bg-surface', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          {title ? <h2 className="text-sm font-semibold text-ink">{title}</h2> : <span />}
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
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
    <div className={cn('flex flex-col justify-between rounded-2xl border-2 px-4 py-3.5', tones[tone], className)}>
      <p className={cn('text-xs font-semibold tracking-wide uppercase', labelTones[tone])}>{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
      {detail ? <p className={cn('mt-1 text-xs', detailTones[tone])}>{detail}</p> : null}
    </div>
  );
}

export function Spinner({ label = 'Cargando' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 text-sm text-muted">
      <span
        aria-hidden="true"
        className="size-4 animate-spin rounded-full border-2 border-line border-t-brand-700"
      />
      {label}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line px-6 py-10 text-center">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? <p className="max-w-md text-sm text-muted">{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-2 rounded-lg border border-danger/40 bg-danger-soft px-4 py-3">
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
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
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
        'm-auto w-[calc(100vw-2rem)] rounded-lg border border-line bg-surface p-0 text-ink backdrop:bg-black/40',
        size === 'lg' ? 'max-w-3xl' : 'max-w-lg',
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-3">
        <div>
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          {description ? <p className="text-sm text-muted">{description}</p> : null}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar dialogo">
          ✕
        </Button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
      {footer ? (
        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>
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
              'pointer-events-auto max-w-sm rounded-md border px-3 py-2 text-sm shadow-sm',
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
