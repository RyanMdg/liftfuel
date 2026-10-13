import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ChevronDown, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'

interface FieldShellProps {
  id: string
  label: string
  /** Visually hide the label (still announced). Only when context makes the purpose obvious. */
  hideLabel?: boolean
  hint?: ReactNode
  error?: string
  unit?: string
  className?: string
  children: ReactNode
}

function FieldShell({ id, label, hideLabel, hint, error, unit, className, children }: FieldShellProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={id} className={cn('mb-1.5 block text-sm font-semibold text-ink', hideLabel && 'sr-only')}>
        {label}
        {unit && <span className="sr-only"> in {unit}</span>}
      </label>
      <div className="relative">
        {children}
        {unit && (
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-muted">
            {unit}
          </span>
        )}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-sm text-danger">
          <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
          {error}
        </p>
      )}
    </div>
  )
}

export const controlClasses =
  'h-10 w-full rounded-sm border border-line-strong bg-white px-3 text-base text-ink placeholder:text-ink-muted ' +
  'hover:border-ink-soft disabled:cursor-not-allowed disabled:bg-surface disabled:text-ink-muted ' +
  'aria-invalid:border-danger'

function describedBy(id: string, hint: unknown, error: unknown) {
  return [error ? `${id}-error` : null, hint && !error ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined
}

interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  hideLabel?: boolean
  hint?: ReactNode
  error?: string
  unit?: string
  containerClassName?: string
  id?: string
  ref?: Ref<HTMLInputElement>
}

export function TextInput({ label, hideLabel, hint, error, unit, containerClassName, className, id, ref, ...rest }: TextInputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <FieldShell id={inputId} label={label} hideLabel={hideLabel} hint={hint} error={error} unit={unit} className={containerClassName}>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, hint, error)}
        className={cn(controlClasses, unit && 'pr-12', className)}
        {...rest}
      />
    </FieldShell>
  )
}

/** Numeric input: decimal keyboard on mobile, tabular numerals, unit suffix. */
export function NumberInput({ className, inputMode = 'decimal', step = 'any', ...rest }: TextInputProps) {
  return <TextInput type="number" inputMode={inputMode} step={step} className={cn('num', className)} {...rest} />
}

interface SelectInputProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string
  hideLabel?: boolean
  hint?: ReactNode
  error?: string
  containerClassName?: string
  id?: string
  ref?: Ref<HTMLSelectElement>
}

export function SelectInput({ label, hideLabel, hint, error, containerClassName, className, id, children, ref, ...rest }: SelectInputProps) {
  const autoId = useId()
  const selectId = id ?? autoId
  return (
    <FieldShell id={selectId} label={label} hideLabel={hideLabel} hint={hint} error={error} className={containerClassName}>
      <select
        ref={ref}
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(selectId, hint, error)}
        className={cn(controlClasses, 'appearance-none pr-9', className)}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-muted" strokeWidth={1.75} />
    </FieldShell>
  )
}

interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string
  hint?: ReactNode
  error?: string
  containerClassName?: string
  id?: string
  ref?: Ref<HTMLTextAreaElement>
}

export function Textarea({ label, hint, error, containerClassName, className, id, ref, ...rest }: TextareaProps) {
  const autoId = useId()
  const areaId = id ?? autoId
  return (
    <FieldShell id={areaId} label={label} hint={hint} error={error} className={containerClassName}>
      <textarea
        ref={ref}
        id={areaId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(areaId, hint, error)}
        className={cn(controlClasses, 'h-auto min-h-20 py-2', className)}
        {...rest}
      />
    </FieldShell>
  )
}

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
  description?: ReactNode
  ref?: Ref<HTMLInputElement>
}

export function Checkbox({ label, description, className, id, ref, ...rest }: CheckboxProps) {
  const autoId = useId()
  const boxId = id ?? autoId
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <input ref={ref} id={boxId} type="checkbox" className="mt-0.5 size-5 shrink-0 accent-teal" {...rest} />
      <label htmlFor={boxId} className="text-sm">
        <span className="font-semibold">{label}</span>
        {description && <span className="block text-ink-soft">{description}</span>}
      </label>
    </div>
  )
}
