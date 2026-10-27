import Link from "next/link";

export function Pagination({ page, pages, makeHref }: { page: number; pages: number; makeHref: (page: number) => string }) {
  if (pages <= 1) return null;
  return <nav className="pagination" aria-label="Catalogue pages">{page > 1 ? <Link href={makeHref(page - 1)}>← Previous</Link> : <span /> }<span>Page {page} of {pages}</span>{page < pages ? <Link href={makeHref(page + 1)}>Next →</Link> : <span />}</nav>;
}
