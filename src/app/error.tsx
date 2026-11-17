"use client";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md space-y-3 p-8">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted">{error.message}</p>
      <button className="btn" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
