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
    <div className="rounded-lg border border-[#ddd2c1] bg-[#fffdf8] p-4">
      <p className="text-sm text-[#70685e]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#1f1a14]">{value}</p>
      {helper ? <p className="mt-1 text-xs text-[#70685e]">{helper}</p> : null}
    </div>
  );
}
