// DataTableComponent.jsx
import DataTable from "react-data-table-component";
import { defaultThemes } from "react-data-table-component";
import ArrowDownward from "@mui/icons-material/ArrowDownward";
import Checkbox from "@mui/material/Checkbox";

import './DataTable.css'

const selectProps = { indeterminate: (isIndeterminate) => isIndeterminate };
const ArrowDownIcon = <ArrowDownward />;

const DataTableComponent = ({
  title,
  columns,
  data,
  defaultSortFieldId,
  onSort,
  progressPending,
  progressComponent,
  fixedHeader,
  fixedHeaderScrollHeight,
  noHeader,
  pagination,
  paginationPerPage,
  paginationRowsPerPageOptions,
  paginationServer,
  expandableRows,
  expandableRowsComponent,
  expandOnRowClicked,
  expandOnRowDoubleClicked,
  expandableRowExpanded,
  expandableRowsHideExpander,

  onRowClicked,
  selectableRows,
  selectableRowsHighlight,
  selectableRowsComponent,
  onSelectedRowsChange,
  clearSelectedRows,
  striped,
  responsive,
  actions,
  subHeaderComponent,
  contextActions,
  persistTableHead,
  defaultSortAsc,
  highlightOnHover,
  dense,
}) => {
  const customStyles = {
    header: {
      style: {
        minHeight: "56px",
      },
    },
    headRow: {
      style: {
        borderTopStyle: "solid",
        borderTopWidth: "1px",
        borderTopColor: defaultThemes.default.divider.default,
      },
    },

    headCells: {
    style: {
      backgroundColor: "#fdd835", // ✅ สีเหลืองเด่น
      color: "#333",
      fontWeight: "bold",
      fontSize: "0.95em",
      textTransform: "uppercase",
      borderBottom: "2px solid #fbc02d",
    },
  },

  
    // headCells: {
    //   style: {
    //     "&:not(:last-of-type)": {
    //       borderRightStyle: "solid",
    //       borderRightWidth: "1px",
    //       borderRightColor: defaultThemes.default.divider.default,
    //     },
    //   },
    // },
    // cells: {
    //   style: {
    //     "&:not(:last-of-type)": {
    //       borderRightStyle: "solid",
    //       borderRightWidth: "1px",
    //       borderRightColor: defaultThemes.default.divider.default,
    //     },
    //   },
    // },
  };


  return (
    <DataTable
      customStyles={customStyles}
      className="dataTables_wrapper"
      title={title}
      columns={columns}
      data={data}
      sortIcon={ArrowDownIcon}
      defaultSortFieldId={defaultSortFieldId}
      defaultSortAsc={defaultSortAsc}
      progressPending={progressPending}
      progressComponent={progressComponent}
      // fixedHeader
      fixedHeaderScrollHeight={fixedHeaderScrollHeight}

      // noHeader={noHeader}
      pagination
      paginationPerPage={paginationPerPage}
      paginationRowsPerPageOptions={[5, 10, 15, 20]}
      paginationServer={paginationServer}
      expandableRows
      expandableRowsComponent={expandableRowsComponent}
      expandOnRowClicked
      expandOnRowDoubleClicked={expandOnRowDoubleClicked}
      expandableRowExpanded={expandableRowExpanded}
      expandableRowsHideExpander
      onRowClicked={onRowClicked}
      selectableRows={selectableRows}
      selectableRowsHighlight
      selectableRowsComponent={Checkbox}
      selectableRowsComponentProps={selectProps}
      onSelectedRowsChange={onSelectedRowsChange}
      clearSelectedRows={clearSelectedRows}
      striped
      responsive={responsive}
      contextActions={contextActions}
      subHeader
      subHeaderComponent={subHeaderComponent}
      persistTableHead={persistTableHead}
      actions={actions}
      highlightOnHover
      dense={dense}
    />
  );
};

export default DataTableComponent;
