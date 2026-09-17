import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";

import ManageAccountsRoundedIcon from "@mui/icons-material/ManageAccountsRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";

import { Box, Paper, Avatar, Typography, Chip, IconButton, Tooltip, Grid, Divider, Stack } from "@mui/material";

import EditModal from "../components/EditStaffModal";

import AuthService from "@/shared/services/authService";
import { useAuth } from "@/features/auth/AuthContext";
import { roleLabel } from "@/shared/utils/roles";

// ---- Design tokens (shared with the files page) --------------------------
const COLOR = {
  bg: "#F6F5F1",
  surface: "#FFFFFF",
  ink: "#20242B",
  sub: "#6C7278",
  line: "#E7E4DC",
  accent: "#3C6659",
  accentSoft: "#E4ECE8",
  accentDeep: "#2A4A40",
  gold: "#B08B3F",
};

const FONT_DISPLAY = `"IBM Plex Sans Thai", "IBM Plex Sans", "Noto Sans Thai", sans-serif`;
const FONT_UI = `"Noto Sans Thai", "IBM Plex Sans", sans-serif`;
const FONT_MONO = `"IBM Plex Mono", ui-monospace, monospace`;

const Account = () => {
  const { updateUserData, userData, refreshUserData } = useAuth();
  const [copied, setCopied] = useState("");

  const [modalOpenEdit, setModalOpenEdit] = useState(false);
  const [editedData, setEditedData] = useState({});
  const [user, setUser] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    getUserData();
  }, []);

  const getUserData = async () => {
    const getUser = await AuthService.getUserData();
    setUser(getUser.user);
  };

  const handleEditFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      const userId = user._id;
      const formData = new FormData();
      for (const [key, value] of Object.entries(editedData)) {
        formData.append(key, value);
      }
      if (selectedFile) {
        formData.append("image", selectedFile);
      }

      const updatedUser = await AuthService.UpdateUser(userId, formData);
      setUser(updatedUser);

      /**
       * ✅ อัปเดตทันทีทุกจุด (ผู้ใช้สั่ง) — ข้อมูลผู้ใช้ถูกใช้วาดชื่อ/รูป/สิทธิ์ทั้งบนหัวเว็บและเมนู
       * ⚠️ เทียบด้วย userId ของ payload (ไม่ใช่ _id ซึ่ง payload ไม่มี) — ของเดิมเทียบผิดฟิลด์
       * ทำให้หัวเว็บไม่อัปเดตจนกว่าจะรีเฟรชหน้า
       */
      if (String(updatedUser?._id || "") === String(userData?.userId || "")) {
        updateUserData({ ...userData, ...updatedUser, userId: String(updatedUser._id) });
        await refreshUserData();
      }

      setModalOpenEdit(false);
      setSelectedFile(null);
      Swal.fire("อัปเดตข้อมูลสำเร็จ", "", "success");
    } catch (error) {
      console.error("Error updating data:", error);
      Swal.fire("อัปเดตข้อมูลไม่สำเร็จ", "", "error");
    }
  };

  const handleCloseModalEdit = () => {
    setModalOpenEdit(false);
  };

  const infoItems = [
    { icon: EmailOutlinedIcon, label: "อีเมล", value: user?.email || "-" },
    { icon: PhoneOutlinedIcon, label: "เบอร์โทร", value: user?.tel || "-" },
    { icon: BadgeOutlinedIcon, label: "สิทธิ์การใช้งาน", value: roleLabel(user) || "-" },
    { icon: WorkOutlineIcon, label: "ตำแหน่ง", value: user?.rank || "ยังไม่ระบุ" },
  ];

  /** คัดลอกอีเมล/เบอร์ — แทนไอคอนโซเชียลปลอมที่ลิงก์ไปไหนไม่ได้ */
  const copy = async (key, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setCopied("");
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: COLOR.bg,
        py: { xs: 4, md: 6 },
        px: 2,
        fontFamily: FONT_UI,
      }}
    >
      <Box sx={{ maxWidth: 760, mx: "auto" }}>
        <Paper
          variant="outlined"
          sx={{
            borderRadius: 4,
            overflow: "hidden",
            borderColor: COLOR.line,
            bgcolor: COLOR.surface,
          }}
        >
          {/* Cover — ⚠️ สูงพอให้ชื่อที่ยกขึ้นมาทับ (mt: -52px) ไม่ไปคร่อมขอบล่างของแถบสี */}
          <Box
            sx={{
              height: 150,
              background: `linear-gradient(135deg, ${COLOR.accentDeep} 0%, ${COLOR.accent} 55%, ${COLOR.gold} 130%)`,
              position: "relative",
            }}
          />

          {/* Identity block */}
          <Box sx={{ px: { xs: 3, md: 4 }, pb: 3 }}>
            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                alignItems: { xs: "center", sm: "flex-end" },
                gap: 2.5,
                mt: "-52px",
                position: "relative",
              }}
            >
              <Box sx={{ position: "relative" }}>
                <Avatar
                  src={user?.imageUrl}
                  alt="Avatar"
                  sx={{
                    width: 104,
                    height: 104,
                    border: `4px solid ${COLOR.surface}`,
                    boxShadow: "0 6px 16px rgba(32,36,43,0.15)",
                    bgcolor: COLOR.accentSoft,
                  }}
                />
                <Tooltip title="แก้ไขข้อมูลส่วนตัว">
                  <IconButton
                    onClick={() => {
                      setEditedData(user);
                      setModalOpenEdit(true);
                    }}
                    sx={{
                      position: "absolute",
                      bottom: -4,
                      right: -4,
                      width: 32,
                      height: 32,
                      bgcolor: COLOR.accent,
                      color: "#fff",
                      border: `2px solid ${COLOR.surface}`,
                      "&:hover": { bgcolor: COLOR.accentDeep },
                    }}
                  >
                    <ManageAccountsRoundedIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              </Box>

              <Box sx={{ textAlign: { xs: "center", sm: "left" }, pb: 0.5 }}>
                <Typography
                  sx={{
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 700,
                    fontSize: 22,
                    color: COLOR.ink,
                    lineHeight: 1.25,
                  }}
                >
                  {user?.fname} {user?.lname}
                </Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ mt: 0.75, justifyContent: { xs: "center", sm: "flex-start" }, flexWrap: "wrap", rowGap: 0.75 }}
                >
                  {user?.role && (
                    <Chip
                      label={roleLabel(user)}
                      size="small"
                      sx={{
                        fontFamily: FONT_UI,
                        fontWeight: 600,
                        fontSize: 12,
                        bgcolor: COLOR.accentSoft,
                        color: COLOR.accentDeep,
                      }}
                    />
                  )}
                  {user?.rank && (
                    <Chip
                      label={user.rank}
                      size="small"
                      variant="outlined"
                      sx={{
                        fontFamily: FONT_UI,
                        fontWeight: 500,
                        fontSize: 12,
                        borderColor: COLOR.line,
                        color: COLOR.sub,
                      }}
                    />
                  )}
                </Stack>
              </Box>
            </Box>

            <Divider sx={{ my: 3, borderColor: COLOR.line }} />

            {/* Info grid */}
            <Typography
              sx={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: 15,
                color: COLOR.ink,
                mb: 1.75,
              }}
            >
              ข้อมูลส่วนตัว
            </Typography>
            <Grid container spacing={2}>
              {infoItems.map(({ icon: Icon, label, value }) => (
                <Grid item xs={12} sm={6} key={label}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 1.25,
                      p: 1.5,
                      borderRadius: 2.5,
                      bgcolor: COLOR.bg,
                      border: `1px solid ${COLOR.line}`,
                    }}
                  >
                    <Avatar
                      variant="rounded"
                      sx={{
                        width: 34,
                        height: 34,
                        borderRadius: 2,
                        bgcolor: COLOR.accentSoft,
                        color: COLOR.accentDeep,
                      }}
                    >
                      <Icon sx={{ fontSize: 18 }} />
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontFamily: FONT_UI, fontSize: 11.5, color: COLOR.sub }}>
                        {label}
                      </Typography>
                      <Typography
                        sx={{
                          fontFamily: FONT_MONO,
                          fontSize: 13.5,
                          color: COLOR.ink,
                          fontWeight: 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {value}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>

            <Divider sx={{ my: 3, borderColor: COLOR.line }} />

            {/* ✅ ช่องทางติดต่อของจริง — กดคัดลอกไปวางได้เลย (เดิมเป็นไอคอนโซเชียลที่ลิงก์ไปไหนไม่ได้) */}
            <Typography
              sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: COLOR.ink, mb: 1.5 }}
            >
              ช่องทางติดต่อ
            </Typography>
            <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
              {[
                { key: "email", label: user?.email, href: user?.email ? `mailto:${user.email}` : "", icon: EmailOutlinedIcon },
                { key: "tel", label: user?.tel, href: user?.tel ? `tel:${String(user.tel).replace(/[^0-9+]/g, "")}` : "", icon: PhoneOutlinedIcon },
              ].filter((c) => c.label).map(({ key, label, href, icon: Icon }) => (
                <Stack
                  key={key}
                  direction="row"
                  alignItems="center"
                  spacing={0.75}
                  sx={{ pl: 1.25, pr: 0.5, py: 0.5, borderRadius: 999, bgcolor: COLOR.bg, border: `1px solid ${COLOR.line}` }}
                >
                  <Icon sx={{ fontSize: 17, color: COLOR.accentDeep }} />
                  <Typography
                    component="a"
                    href={href}
                    sx={{ fontFamily: FONT_MONO, fontSize: 13, color: COLOR.ink, textDecoration: "none" }}
                  >
                    {label}
                  </Typography>
                  <Tooltip title={copied === key ? "คัดลอกแล้ว" : "คัดลอก"} describeChild>
                    <IconButton size="small" onClick={() => copy(key, label)}>
                      {copied === key
                        ? <CheckRoundedIcon sx={{ fontSize: 16, color: COLOR.accent }} />
                        : <ContentCopyRoundedIcon sx={{ fontSize: 15, color: COLOR.sub }} />}
                    </IconButton>
                  </Tooltip>
                </Stack>
              ))}
            </Stack>
          </Box>
        </Paper>
      </Box>

      <EditModal
        show={modalOpenEdit}
        handleClose={handleCloseModalEdit}
        handleSubmit={handleEdit}
        handleEditFileChange={handleEditFileChange}
        editedData={editedData}
        selectedFile={selectedFile}
        setEditedData={setEditedData}
        setSelectedFile={setSelectedFile}
        setModalOpenEdit={setModalOpenEdit}
      />
    </Box>
  );
};

export default Account;