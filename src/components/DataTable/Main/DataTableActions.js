// DataTableActions.jsx
import { IconButton } from "@mui/material";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import AddIcon from "@mui/icons-material/Add";

const DataTableActions = [
  <IconButton key="export-csv" aria-label="export csv" data-toggle="tooltip" data-placement="top" title="Export CSV">
    <CloudDownloadIcon />
  </IconButton>,


  <IconButton key="insert-product" aria-label="Insert products" data-toggle="tooltip" data-placement="top" title="เพิ่มข้อมูลสินค้าใหม่">
    <AddIcon />
  </IconButton>,
];

export default DataTableActions;
