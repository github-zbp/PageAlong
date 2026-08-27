export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-5">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">有声课程</h1>
          <p className="text-sm text-[var(--pa-muted)]">把网页和文档变成路上能听的课程</p>
        </div>
      </header>
      {children}
    </main>
  );
}

