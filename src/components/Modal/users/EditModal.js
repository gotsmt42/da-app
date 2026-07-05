import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Avatar,
  Box,
  Typography,
  TextField,
  Button,
  Divider,
  Grid,
  Chip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

// ---- Design tokens (shared across the app) --------------------------------
const COLOR = {
  bg: "#F6F5F1",
  surface: "#FFFFFF",
  ink: "#20242B",
  sub: "#6C7278",
  line: "#E7E4DC",
  accent: "#3C6659",
  accentSoft: "#E4ECE8",
  accentDeep: "#2A4A40",
};

const FONT_DISPLAY = `"IBM Plex Sans Thai", "IBM Plex Sans", "Noto Sans Thai", sans-serif`;
const FONT_UI = `"Noto Sans Thai", "IBM Plex Sans", sans-serif`;

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: 2,
    bgcolor: COLOR.bg,
    fontFamily: FONT_UI,
    fontSize: 14,
  },
  "& .MuiInputLabel-root": { fontFamily: FONT_UI, fontSize: 13.5 },
};

const EditProductModal = ({
  show,
  handleClose,
  handleSubmit,
  handleEditFileChange,
  editedData,
  selectedFile,
  setEditedData,
  setModalOpenEdit,
}) => {
  const initials = `${editedData?.fname?.[0] || ""}${editedData?.lname?.[0] || ""}`;

  return (
    <Dialog
      open={show}
      onClose={() => setModalOpenEdit(false)}
      scroll="paper"
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: { borderRadius: 4, bgcolor: COLOR.surface, fontFamily: FONT_UI },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 3,
          pt: 2.5,
          pb: 2,
          borderBottom: `1px solid ${COLOR.line}`,
        }}
      >
        <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: COLOR.ink }}>
          แก้ไขข้อมูลส่วนตัว
        </Typography>
        <IconButton onClick={handleClose} size="small" sx={{ color: COLOR.sub }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 3, py: 3, bgcolor: COLOR.surface }}>
        {/* Avatar + upload */}
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 3 }}>
          <Box sx={{ position: "relative" }}>
            <Avatar
              src={selectedFile ? URL.createObjectURL(selectedFile) : editedData?.imageUrl}
              alt="Avatar"
              sx={{
                width: 108,
                height: 108,
                border: `3px solid ${COLOR.surface}`,
                boxShadow: "0 4px 14px rgba(32,36,43,0.15)",
                bgcolor: COLOR.accentSoft,
                color: COLOR.accentDeep,
                fontFamily: FONT_DISPLAY,
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              {!editedData?.imageUrl && !selectedFile ? initials : null}
            </Avatar>
            <IconButton
              component="label"
              sx={{
                position: "absolute",
                bottom: -2,
                right: -2,
                width: 34,
                height: 34,
                bgcolor: COLOR.accent,
                color: "#fff",
                border: `2px solid ${COLOR.surface}`,
                "&:hover": { bgcolor: COLOR.accentDeep },
              }}
            >
              <PhotoCameraOutlinedIcon sx={{ fontSize: 17 }} />
              <input hidden type="file" accept="image/*" onChange={handleEditFileChange} />
            </IconButton>
          </Box>
          <Typography sx={{ fontFamily: FONT_UI, fontSize: 12, color: COLOR.sub, mt: 1 }}>
            คลิกไอคอนกล้องเพื่อเปลี่ยนรูปโปรไฟล์
          </Typography>
        </Box>

        <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: COLOR.ink, mb: 1.5 }}>
          ข้อมูลที่แก้ไขได้
        </Typography>
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="ชื่อ"
              fullWidth
              size="small"
              defaultValue={editedData?.fname}
              onChange={(e) => setEditedData({ ...editedData, fname: e.target.value })}
              sx={fieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="นามสกุล"
              fullWidth
              size="small"
              defaultValue={editedData?.lname}
              onChange={(e) => setEditedData({ ...editedData, lname: e.target.value })}
              sx={fieldSx}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="เบอร์โทร"
              fullWidth
              size="small"
              defaultValue={editedData?.tel}
              onChange={(e) => setEditedData({ ...editedData, tel: e.target.value })}
              sx={fieldSx}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="คำอธิบายตัวตน"
              fullWidth
              multiline
              rows={4}
              defaultValue={editedData?.description}
              onChange={(e) => setEditedData({ ...editedData, description: e.target.value })}
              sx={fieldSx}
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 3, borderColor: COLOR.line }} />

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
          <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: COLOR.ink }}>
            ข้อมูลระบบ
          </Typography>
          <Chip
            icon={<LockOutlinedIcon sx={{ fontSize: 14 }} />}
            label="แก้ไขไม่ได้"
            size="small"
            sx={{
              fontFamily: FONT_UI,
              fontSize: 11,
              height: 22,
              bgcolor: COLOR.bg,
              color: COLOR.sub,
              border: `1px solid ${COLOR.line}`,
            }}
          />
        </Box>
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="อีเมล"
              fullWidth
              size="small"
              disabled
              defaultValue={editedData?.email}
              sx={fieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="ชื่อผู้ใช้"
              fullWidth
              size="small"
              disabled
              defaultValue={editedData?.username}
              sx={fieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="ตำแหน่ง"
              fullWidth
              size="small"
              disabled
              defaultValue={editedData?.rank}
              sx={fieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="สถานะ"
              fullWidth
              size="small"
              disabled
              defaultValue={editedData?.role}
              sx={fieldSx}
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${COLOR.line}`, gap: 1 }}>
        <Button
          onClick={handleClose}
          sx={{
            textTransform: "none",
            fontFamily: FONT_UI,
            fontWeight: 600,
            color: COLOR.sub,
            borderRadius: 2.5,
          }}
        >
          ยกเลิก
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          sx={{
            textTransform: "none",
            fontFamily: FONT_UI,
            fontWeight: 600,
            bgcolor: COLOR.accent,
            "&:hover": { bgcolor: COLOR.accentDeep },
            borderRadius: 2.5,
            boxShadow: "none",
            px: 3,
          }}
        >
          บันทึกการเปลี่ยนแปลง
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditProductModal;