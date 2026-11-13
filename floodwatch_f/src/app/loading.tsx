/** Shown while a server-rendered page waits for the backend. */
export default function Loading() {
  return (
    <div className="shell py-10" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="fw-skeleton h-9 w-72" />
      <div className="fw-skeleton mt-3 h-4 w-full max-w-xl" />
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="fw-skeleton h-24" />
        ))}
      </div>
      <div className="fw-skeleton mt-6 h-[45vh]" />
    </div>
  );
}
