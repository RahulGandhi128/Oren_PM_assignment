import Link from "next/link";

export default function NotFound() {
  return (
    <section className="flex flex-col gap-4 py-8">
      <p className="text-micro uppercase text-muted">404</p>
      <h1 className="font-display text-h1">We couldn&apos;t find that page.</h1>
      <Link href="/" className="text-accent underline-offset-4 hover:underline">Back to the overview</Link>
    </section>
  );
}
