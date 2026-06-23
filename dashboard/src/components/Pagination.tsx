const FIRST_PAGE = 1;
const PAGE_STEP = 1;

const Pagination = ({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (p: number) => void }) => (
  <div className="pagination">
    <button disabled={page <= FIRST_PAGE} onClick={() => onPage(page - PAGE_STEP)}>
      Previous
    </button>
    <span className="page-info">
      Page {page} of {totalPages} ({total} total)
    </span>
    <button disabled={page >= totalPages} onClick={() => onPage(page + PAGE_STEP)}>
      Next
    </button>
  </div>
);

export default Pagination;
