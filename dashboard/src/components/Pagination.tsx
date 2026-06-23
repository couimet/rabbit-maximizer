const Pagination = ({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
}) => (
  <div className="pagination">
    <button disabled={page <= 1} onClick={() => onPage(page - 1)}>
      Previous
    </button>
    <span className="page-info">
      Page {page} of {totalPages} ({total} total)
    </span>
    <button disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
      Next
    </button>
  </div>
);

export default Pagination;
