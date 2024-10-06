// DataTableContextActions.jsx
import { IconButton } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";

const DataTableContextActions = ({ handleDelete, handleDownload }) => [
  <IconButton
    key="icon-download"
    aria-label="icon download"
    onClick={handleDownload}
  >
    <DownloadIcon />
  </IconButton>,

  <IconButton
    key="icon-delete"
    aria-label="icon delete"
    color="warning"
    onClick={handleDelete}
  >
    <DeleteIcon />
  </IconButton>,
];

export default DataTableContextActions;
