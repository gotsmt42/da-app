// DataTableSubHeader.jsx

const DataTableSubHeader = ({ search, setSearch }) => {
  return (
    <input
      className="w-25 form-control"
      type="search"
      placeholder="Search here"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
    />
  );
};

export default DataTableSubHeader;
