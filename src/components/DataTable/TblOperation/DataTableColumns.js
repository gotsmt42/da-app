import { useState, useEffect } from "react";
import moment from "moment";
import IconButton from "@mui/material/IconButton";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import EditIcon from "@mui/icons-material/Edit";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { styled } from "@mui/material/styles";
import Delete from "@mui/icons-material/Delete";
import EventService from "../../../services/EventService";

import StatusSelectCell from "./StatusSelectCell"; // ✅ import component
import StatusTwoSelectCell from "./StatusTwoSelectCell"; // ✅ import component
import StatusThreeSelectCell from "./StatusThreeSelectCell"; // ✅ import component

const StyledMenu = styled((props) => (
  <Menu
    elevation={0}
    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
    transformOrigin={{ vertical: "top", horizontal: "right" }}
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
  onStatusUpdate, // ✅ รับจาก parent
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const [selectedRowMenu, setSelectedRowMenu] = useState(null);
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

  const columns = [
       {
      name: "วันที่เข้าดำเนินการ",
      width: "180px",

      sortable: true,
      sortFunction: (a, b) => new Date(a.start) - new Date(b.start),

      cell: (row) => (
        <div>
          <div style={{ fontSize: "0.9em", color: "#333" }}>
            <span>{moment(row.start).format("DD/MM/YYYY")}</span>
             {" - "}
            <span>{moment(row.end).subtract(1, "days").format("DD/MM/YYYY")}</span>
          </div>
        </div>
      ),
    },
    // {
    //   name: "อ้างอิงเอกสารเลขที่ ",
    //   sortable: true,
    //   width: "130px",

    //   selector: (row) => row.company,

    //   cell: (row) => (
    //     <div>
    //       <div>QT2025060215</div>
    //     </div>
    //   ),
    // },
    {
      name: "งาน / โครงการ",
      width: "370px",

      sortable: true,
      sortFunction: (a, b) => new Date(a.start) - new Date(b.start),
      cell: (row) => (
        <div>
          <div style={{ fontSize: "0.8em", color: "#888" }}>
            [{row.title}] - {row.system}
          </div>
          <div>{row.site}</div>
        </div>
      ),
    },
        {
      name: "การดำเนินการ",
      sortable: true,
      width: "210px",

      selector: (row) => row.status,
      cell: (row) => (
        <StatusSelectCell row={row} onStatusUpdate={onStatusUpdate} />
      ),
    },
   {
     name: (
      <div style={{ textAlign: "center", width: "100%" }}>
        สถานะ 1
      </div>
    ),
      sortable: true,

      width: "210px",

      selector: (row) => row.status,
      cell: (row) => (
        <StatusTwoSelectCell row={row} onStatusUpdate={onStatusUpdate} />
      ),
    },
 
    {
    name: (
      <div style={{ textAlign: "center", width: "100%" }}>
        สถานะ 2
      </div>
    ),      sortable: true,
      width: "210px",

      selector: (row) => row.status,
      cell: (row) => (
        <StatusThreeSelectCell row={row} onStatusUpdate={onStatusUpdate} />
      ),
    },

    {
      name: "Action",
      width: "80px",
      cell: (row) => (
        <div>
          <IconButton
            id="demo-customized-button"
            aria-controls={open ? "demo-customized-menu" : undefined}
            aria-haspopup="true"
            aria-expanded={open ? "true" : undefined}
            onClick={(event) => handleClick(event, row)}
          >
            <MoreVertIcon />
          </IconButton>

          <StyledMenu
            id="demo-customized-menu"
            MenuListProps={{ "aria-labelledby": "demo-customized-button" }}
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
    },
  ];

  return columns;
};

export default DataTableColumns;
