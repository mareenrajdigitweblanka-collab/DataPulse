import type { JobStatus } from "@/lib/types";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span
        className="mb-1 block text-sm font-semibold"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </span>
      {children}
      {hint && (
        <span
          className="mt-1 block text-xs"
          style={{ color: "var(--text-tertiary)" }}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className="flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors"
      style={{
        borderColor: "var(--border-primary)",
        background: "var(--bg-secondary)",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[var(--accent-primary)]"
      />
      <span
        className="text-sm font-semibold"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </span>
    </label>
  );
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  done: { bg: "var(--success-soft)", color: "var(--success)" },
  error: { bg: "var(--error-soft)", color: "var(--error)" },
  timeout: { bg: "var(--error-soft)", color: "var(--error)" },
  filtering: { bg: "rgba(168, 85, 247, 0.1)", color: "#a855f7" },
  running: { bg: "var(--accent-primary-soft)", color: "var(--accent-primary)" },
  queued: { bg: "var(--bg-tertiary)", color: "var(--text-secondary)" },
};

export function StatusBadge({ status }: { status: JobStatus }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.queued;

  return (
    <span
      className="rounded-full px-3 py-1 text-xs font-bold uppercase"
      style={{
        background: style.bg,
        color: style.color,
      }}
    >
      {status}
    </span>
  );
}

export function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--bg-tertiary)" }}
    >
      <p
        className="text-xs font-semibold uppercase"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-lg font-bold"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </p>
    </div>
  );
}

export function EmptyBox({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl border border-dashed p-8 text-center text-sm"
      style={{
        borderColor: "var(--border-secondary)",
        color: "var(--text-tertiary)",
      }}
    >
      {message}
    </div>
  );
}