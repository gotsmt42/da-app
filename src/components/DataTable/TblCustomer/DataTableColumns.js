import { useState, useEffect } from "react";
import moment from "moment"; // Import moment library for date formatting
import IconButton from "@mui/material/IconButton";

import MoreVertIcon from "@mui/icons-material/MoreVert";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import EditIcon from "@mui/icons-material/Edit";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";

import { styled } from "@mui/material/styles";
import Delete from "@mui/icons-material/Delete";
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
      "rgb(255, 255, 255) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px",
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
  const open = Boolean(anchorEl);
  const [selectedRowMenu, setSelectedRowMenu] = useState(null);

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

  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsSmallScreen(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const columns = [
    {
      name: "ชื่อโครงการ",
      cell: (row) => <CustomCell row={row} isSmallScreen={isSmallScreen} />,
      sortable: true,
      selector: (row) => row.projectName,
    },

    {
      name: "ที่อยู่",
      sortable: true,
      selector: (row) => row.address, // ตัวอย่าง: "อยู่ระหว่างดำเนินการ", "สำเร็จ", "เลื่อน", "ยกเลิก"
      cell: (row) => (
        // <span style={{ color: row.status === "สำเร็จ" ? "green" : "orange" }}>
        //   {row.status}
        // </span>

        <span >123/999</span>
      ),
    },

    {
      name: "อีเมลล์",
      sortable: true,
      selector: (row) => row.address, // ตัวอย่าง: "อยู่ระหว่างดำเนินการ", "สำเร็จ", "เลื่อน", "ยกเลิก"
      cell: (row) => (
        // <span style={{ color: row.status === "สำเร็จ" ? "green" : "orange" }}>
        //   {row.status}
        // </span>

        <span >test@test.com</span>
      ),
    },

   
    {
      name: "เอกสารที่เกี่ยวข้อง",
      cell: (row) => (
        <a className="btn btn-primary btn-sm" href={row.documentLink} target="_blank" rel="noopener noreferrer">
          ดาวน์โหลด
        </a>
      ),
      width: "150px",
    },
    {
      name: "Action",
      cell: (row) => (
        <div>
          <IconButton
            id="demo-customized-button"
            aria-controls={open ? "demo-customized-menu" : undefined}
            aria-haspopup="true"
            aria-expanded={open ? "true" : undefined}
            variant="contained"
            onClick={(event) => handleClick(event, row)}
          >
            <MoreVertIcon />
          </IconButton>

          <StyledMenu
            id="demo-customized-menu"
            MenuListProps={{
              "aria-labelledby": "demo-customized-button",
            }}
            anchorEl={anchorEl}
            open={open && selectedRowMenu === row}
            onClose={handleClose}
          >
            <MenuItem
              onClick={() => {
                setModalOpenEdit(true);
                handleClose();
              }}
            >
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
            <MenuItem onClick={handleClose} disableRipple>
              <MoreHorizIcon />
              เพิ่มเติม
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
