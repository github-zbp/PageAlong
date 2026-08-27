export function SummaryCard({
  label,
  value,
  helper
}: {
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--pa-line)] bg-[var(--pa-surface)] p-4">
      <p className="text-sm text-[var(--pa-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--pa-ink)]">{value}</p>
      {helper ? <p className="mt-1 text-xs text-[var(--pa-muted)]">{helper}</p> : null}
    </div>
  );
}
