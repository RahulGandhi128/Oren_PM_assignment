import Link from "next/link";

export function Footer() {
  return (
    <footer className="no-print mt-9 border-t hairline">
      <div className="mx-auto flex max-w-page flex-col gap-2 px-gutter py-5 text-small text-muted">
        <p className="flex flex-wrap items-center gap-x-2">
          <span>Numbers <span className="text-ink underline decoration-dotted decoration-prov-assumption underline-offset-4">underlined like this</span> depend on assumptions you can change in <Link href="/methodology#assumptions" className="text-accent hover:underline">Methodology</Link>. Hover any number for its source.</span>
        </p>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link href="/methodology#sources" className="text-accent underline-offset-4 hover:underline">Sources</Link>
        </div>
      </div>
    </footer>
  );
}
