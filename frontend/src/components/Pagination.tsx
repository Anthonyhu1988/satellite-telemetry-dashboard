import type { Pagination as PaginationInfo } from '@telemetry/shared';

interface Props {
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
}

export function Pagination({ pagination, onPageChange }: Props) {
  const { page, limit, total, totalPages } = pagination;
  if (total === 0) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="pagination__info">
        Showing {from}–{to} of {total}
      </span>
      <div className="pagination__controls">
        <button
          type="button"
          className="btn btn--ghost"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <span aria-current="page">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
