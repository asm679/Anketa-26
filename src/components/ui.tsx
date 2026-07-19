import type { ReactNode } from 'react';
import clsx from 'clsx';

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-xs text-muted mb-1">
          <span>{label}</span>
          <span>{Math.round(pct)}%</span>
        </div>
      )}
      <div className="h-2 rounded-full bg-surface-alt overflow-hidden">
        <div
          className="h-full bg-navy transition-all duration-300 ease-out rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function Notice({
  kind = 'info',
  children,
}: {
  kind?: 'info' | 'error' | 'success' | 'warning';
  children: ReactNode;
}) {
  const styles: Record<string, string> = {
    info: 'bg-navy-50 border-navy-med/30 text-navy-dark',
    error: 'bg-error/10 border-error/40 text-error',
    success: 'bg-success/10 border-success/40 text-success',
    warning: 'bg-warning/10 border-warning/40 text-warning',
  };
  return (
    <div className={clsx('rounded-lg border px-4 py-3 text-sm', styles[kind])} role="status">
      {children}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('bg-white rounded-xl shadow-card border border-border-light p-5 sm:p-6', className)}>
      {children}
    </div>
  );
}

const SCALE_LABELS = [
  'Не знаком(а)',
  'Слышал(а), но не могу объяснить',
  'Понимаю суть, не применял(а)',
  'Уверенно ориентируюсь',
  'Применяю на практике / могу объяснить другим',
];

export function ScaleSelector({
  value,
  onChange,
  name,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  name: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 sm:gap-2" role="radiogroup" aria-label="Оценка от 0 до 4">
      {[0, 1, 2, 3, 4].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          title={SCALE_LABELS[n]}
          onClick={() => onChange(n)}
          className={clsx(
            'flex flex-col items-center justify-center rounded-lg border w-14 h-14 sm:w-16 sm:h-16 text-sm font-medium transition-all shrink-0',
            value === n
              ? 'bg-navy text-white border-navy shadow-card'
              : 'bg-white text-ink border-border hover:border-navy-med hover:bg-navy-50'
          )}
          data-testid={`scale-${name}-${n}`}
        >
          <span className="text-base sm:text-lg font-display">{n}</span>
        </button>
      ))}
    </div>
  );
}

export function ScaleLegend() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs text-muted mb-4">
      {SCALE_LABELS.map((label, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-navy-50 text-navy-dark font-semibold shrink-0">
            {i}
          </span>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = 'button',
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg bg-navy text-white px-5 py-2.5 text-sm font-medium transition-colors hover:bg-navy-dark disabled:opacity-40 disabled:cursor-not-allowed',
        className
      )}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-white text-ink px-5 py-2.5 text-sm font-medium transition-colors hover:bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed',
        className
      )}
    >
      {children}
    </button>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = 'text',
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  error?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink mb-1">
        {label} {required && <span className="text-error">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={clsx(
          'w-full rounded-lg border px-3 py-2.5 text-sm bg-white transition-colors focus:border-navy',
          error ? 'border-error' : 'border-border'
        )}
      />
      {hint && !error && <span className="block text-xs text-faint mt-1">{hint}</span>}
      {error && <span className="block text-xs text-error mt-1">{error}</span>}
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink mb-1">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-lg border border-border px-3 py-2.5 text-sm bg-white transition-colors focus:border-navy resize-vertical"
      />
    </label>
  );
}
