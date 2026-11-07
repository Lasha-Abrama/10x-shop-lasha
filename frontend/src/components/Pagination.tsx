import { Link } from 'react-router';
import { catalogPageNumbers, catalogParams } from '../catalog/query';
import type { CatalogQuery } from '../catalog/query';

export function Pagination({ query, totalPages }: { query: CatalogQuery; totalPages: number }) {
  const href = (page: number) => `?${catalogParams({ ...query, page })}`;
  return <nav aria-label="Product pages" className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-sm">
    {query.page > 1 ? <Link className="text-link touch-target" rel="prev" to={href(query.page - 1)}>Previous</Link> : <span className="touch-target text-muted" aria-disabled="true">Previous</span>}
    <ol className="order-last flex w-full flex-wrap items-center justify-center gap-1 sm:order-none sm:w-auto">
      {catalogPageNumbers(query.page, totalPages).map((page, index) => <li key={page ?? `gap-${index}`}>
        {page === null ? <span className="px-2 text-muted" aria-hidden="true">…</span>
          : page === query.page ? <span aria-current="page" aria-label={`Page ${page}, current page`} className="touch-target min-w-11 justify-center rounded-editorial bg-ink px-3 text-paper tabular-nums">{page}</span>
            : <Link aria-label={`Page ${page}`} className="nav-link touch-target min-w-11 justify-center rounded-editorial px-3 tabular-nums hover:bg-surface" to={href(page)}>{page}</Link>}
      </li>)}
    </ol>
    {query.page < totalPages ? <Link className="text-link touch-target" rel="next" to={href(query.page + 1)}>Next</Link> : <span className="touch-target text-muted" aria-disabled="true">Next</span>}
    <p className="sr-only">Page {query.page} of {totalPages}</p>
  </nav>;
}
