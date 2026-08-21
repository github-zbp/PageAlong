export function PageHeader({
  title,
  subtitle,
  action
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-col gap-3 border-b border-[#ddd2c1] pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-[#1f1a14]">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[#70685e]">{subtitle}</p>
      </div>
      {action}
    </header>
  );
}
