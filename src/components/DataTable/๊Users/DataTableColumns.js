import { useState, useEffect } from "react";
import IconButton from "@mui/material/IconButton";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import EditIcon from "@mui/icons-material/Edit";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import Delete from "@mui/icons-material/Delete";
import { styled } from "@mui/material/styles";
import CustomCell from "./customCell";

const StyledMenu = styled((props) => (
  <Menu
    elevation={0}
    anchorOrigin={{
      vertical: "bottom",
      horizontal: "right",
    }}
    transformOrigin={{
      vertical: "top",
      horizontal: "right",
    }}
    {...props}
  />
))(({ theme }) => ({
  "& .MuiPaper-root": {
    borderRadius: 6,
    marginTop: theme.spacing(1),
    minWidth: 180,
    color:
      theme.palette.mode === "light"
        ? "rgb(55, 65, 81)"
        : theme.palette.grey[300],
    boxShadow:
      "rgba(0, 0, 0, 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0px 10px 15px -3px",
    "& .MuiMenu-list": {
      padding: "4px 0",
    },
    "& .MuiMenuItem-root": {
      "& .MuiSvgIcon-root": {
        fontSize: 18,
        color: theme.palette.text.secondary,
        marginRight: theme.spacing(1.5),
      },
    },
  },
}));

const DataTableColumns = ({
  setSelectedRow,
  setEditedData,
  setModalOpenEdit,
  handleDeleteRow,
  setSelectedFile,
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedRowMenu, setSelectedRowMenu] = useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (event, row) => {
    setSelectedRowMenu(row);
    setAnchorEl(event.currentTarget);
    setSelectedRow(row);
    setEditedData(row);
  };

  const handleClose = () => {
    setSelectedRowMenu(null);
    setAnchorEl(null);
    setSelectedFile(null);
  };

  const handleEditClick = (row) => {
    setEditedData(row);
    setModalOpenEdit(true);
    handleClose();
  };

  const columns = [
    {
      name: "ชื่อ-นามสกุล",
      cell: (row) => <CustomCell row={row} />,
      sortable: true,
      selector: (row) => row.fname,
    },
    {
      name: "อีเมลล์",
      sortable: true,
      selector: (row) => row.email,
    },

    {
      name: "ระดับการใช้งาน",
      sortable: true,
      selector: (row) => row.role,
    },
    {
      cell: (row) => (
        <div>
          <IconButton
            aria-controls={open ? "customized-menu" : undefined}
            aria-haspopup="true"
            onClick={(event) => handleClick(event, row)}
          >
            <MoreVertIcon />
          </IconButton>

          <StyledMenu
            anchorEl={anchorEl}
            open={open && selectedRowMenu === row}
            onClose={handleClose}
          >
            <MenuItem onClick={() => handleEditClick(row)}>
              <EditIcon />
              แก้ไข
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleDeleteRow(row._id);
                handleClose();
              }}
            >
              <Delete />
              ลบ
            </MenuItem>
            <MenuItem onClick={handleClose}>
              <MoreHorizIcon />
              รายละเอียด
            </MenuItem>
          </StyledMenu>
        </div>
      ),
      width: "80px",
    },
  ];

  return columns;
};

export default DataTableColumns;
