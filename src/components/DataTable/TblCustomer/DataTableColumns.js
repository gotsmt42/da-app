import { useState, useEffect } from "react";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";

import MoreVertIcon from "@mui/icons-material/MoreVert";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import EditIcon from "@mui/icons-material/Edit";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ApartmentIcon from "@mui/icons-material/Apartment";

import { styled, alpha } from "@mui/material/styles";
import Delete from "@mui/icons-material/Delete";

// ─── Styled menu (คงของเดิม แต่ปรับ shadow ให้นุ่มขึ้นเล็กน้อย) ─────────
const StyledMenu = styled((props) => (
  <Menu
    elevation={0}
    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
    transformOrigin={{ vertical: "top", horizontal: "right" }}
    {...props}
  />
))(({ theme }) => ({
  "& .MuiPaper-root": {
    borderRadius: 10,
    marginTop: theme.spacing(1),
    minWidth: 180,
    color: theme.palette.mode === "light" ? "rgb(55, 65, 81)" : theme.palette.grey[300],
    boxShadow: "0 10px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)",
    "& .MuiMenu-list": { padding: "4px 0" },
    "& .MuiMenuItem-root": {
      fontSize: "0.875rem",
      gap: 4,
      "& .MuiSvgIcon-root": {
        fontSize: 18,
        color: theme.palette.text.secondary,
        marginRight: theme.spacing(1),
      },
      "&:hover": { backgroundColor: alpha(theme.palette.primary.main, 0.06) },
    },
  },
}));

// ─── Helpers ────────────────────────────────────────────────────────────
const AVATAR_PALETTE = ["#667eea", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

const colorFromName = (name = "") => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
};

const copyToClipboard = (text) => {
  if (!text) return;
  navigator.clipboard.writeText(text);
};

// เซลล์: บริษัท + โครงการ พร้อม avatar ตัวอักษรแรก (แทนที่จะแยกเป็น 2 คอลัมน์)
const CompanyCell = ({ row }) => {
  const initial = (row.cCompany || "?").charAt(0).toUpperCase();
  const color = colorFromName(row.cCompany || "");
  return (
    <Stack direction="row" alignItems="center" gap={1.25} sx={{ py: 1, minWidth: 0 }}>
      <Avatar sx={{
        width: 34, height: 34, fontSize: "0.85rem", fontWeight: 700, flexShrink: 0,
        bgcolor: alpha(color, 0.15), color,
      }}>
        {initial}
      </Avatar>
      <Box minWidth={0}>
        <Typography fontWeight={700} fontSize="0.85rem" noWrap>
          {row.cCompany || "—"}
        </Typography>
        <Stack direction="row" alignItems="center" gap={0.4}>
          <ApartmentIcon sx={{ fontSize: 12, color: "text.disabled" }} />
          <Typography variant="caption" color="text.secondary" noWrap>
            {row.cSite || "ไม่ระบุโครงการ"}
          </Typography>
        </Stack>
      </Box>
    </Stack>
  );
};

// เซลล์: อีเมล พร้อมปุ่มคัดลอก
const EmailCell = ({ row }) => {
  if (!row.cEmail) return <Chip label="ไม่มีอีเมล" size="small" variant="outlined" sx={{ fontSize: "0.68rem", height: 22, color: "text.disabled" }} />;
  return (
    <Stack direction="row" alignItems="center" gap={0.5} sx={{ minWidth: 0 }}>
      <EmailIcon sx={{ fontSize: 15, color: "text.disabled", flexShrink: 0 }} />
      <Typography variant="body2" noWrap sx={{ fontSize: "0.8rem" }}>{row.cEmail}</Typography>
      <Tooltip title="คัดลอกอีเมล">
        <IconButton size="small" onClick={() => copyToClipboard(row.cEmail)} sx={{ p: 0.4 }}>
          <ContentCopyIcon sx={{ fontSize: 13 }} />
        </IconButton>
      </Tooltip>
    </Stack>
  );
};

// เซลล์: เบอร์โทร พร้อมปุ่มคัดลอก
const PhoneCell = ({ row }) => {
  if (!row.tel) return <Chip label="ไม่มีเบอร์" size="small" variant="outlined" sx={{ fontSize: "0.68rem", height: 22, color: "text.disabled" }} />;
  return (
    <Stack direction="row" alignItems="center" gap={0.5}>
      <PhoneIcon sx={{ fontSize: 15, color: "text.disabled", flexShrink: 0 }} />
      <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>{row.tel}</Typography>
      <Tooltip title="คัดลอกเบอร์โทร">
        <IconButton size="small" onClick={() => copyToClipboard(row.tel)} sx={{ p: 0.4 }}>
          <ContentCopyIcon sx={{ fontSize: 13 }} />
        </IconButton>
      </Tooltip>
    </Stack>
  );
};

// เซลล์: ที่อยู่ ตัดคำยาวๆ พร้อม tooltip แสดงเต็ม
const AddressCell = ({ row }) => {
  if (!row.address) return <Typography variant="caption" color="text.disabled">—</Typography>;
  return (
    <Tooltip title={row.address}>
      <Typography variant="body2" sx={{
        fontSize: "0.8rem", maxWidth: 220, whiteSpace: "nowrap",
        overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {row.address}
      </Typography>
    </Tooltip>
  );
};

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
    const handleResize = () => setIsSmallScreen(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const columns = [
    {
      name: "บริษัท / โครงการ",
      sortable: true,
      minWidth: "220px",
      selector: (row) => row.cCompany,
      cell: (row) => <CompanyCell row={row} />,
    },
    {
      name: "ชื่อโปรเจค",
      sortable: true,
      selector: (row) => row.projName,
      omit: isSmallScreen,
      cell: (row) => (
        <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>{row.projName || "—"}</Typography>
      ),
    },
    {
      name: "ผู้ติดต่อ",
      sortable: true,
      selector: (row) => row.cName,
      omit: isSmallScreen,
      cell: (row) => (
        <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.8rem" }}>{row.cName || "—"}</Typography>
      ),
    },
    {
      name: "อีเมล",
      sortable: true,
      minWidth: "200px",
      selector: (row) => row.cEmail,
      cell: (row) => <EmailCell row={row} />,
    },
    {
      name: "ที่อยู่",
      sortable: true,
      omit: isSmallScreen,
      selector: (row) => row.address,
      cell: (row) => <AddressCell row={row} />,
    },
    {
      name: "เบอร์โทร",
      sortable: true,
      selector: (row) => row.tel,
      cell: (row) => <PhoneCell row={row} />,
    },
    {
      name: "",
      width: "64px",
      cell: (row) => (
        <div>
          <IconButton
            id="demo-customized-button"
            aria-controls={open ? "demo-customized-menu" : undefined}
            aria-haspopup="true"
            aria-expanded={open ? "true" : undefined}
            size="small"
            onClick={(event) => handleClick(event, row)}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>

          <StyledMenu
            id="demo-customized-menu"
            MenuListProps={{ "aria-labelledby": "demo-customized-button" }}
            anchorEl={anchorEl}
            open={open && selectedRowMenu === row}
            onClose={handleClose}
          >
            <MenuItem onClick={() => { setModalOpenEdit(true); handleClose(); }}>
              <EditIcon />
              แก้ไข
            </MenuItem>
            <MenuItem onClick={() => { handleDeleteRow(row._id); handleClose(); }}>
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