import { useMemo } from "react";
import { Autocomplete, Avatar, Box, Stack, TextField, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { PersonOutline, ManageAccounts } from "@mui/icons-material";
import { hasValidAvatar } from "@/shared/utils/user";
import { personColor, personInitial } from "@/shared/utils/personAvatar";

/**
 * ช่องเลือก "ผู้รับผิดชอบงาน" แบบเด่น — กล่องสีอ่อนพร้อมรูป/อักษรย่อของคนที่เลือก
 *
 * ✅ ทำไมต้องเด่นกว่าช่องอื่น: ผู้รับผิดชอบคือคนที่ระบบใช้ตัดสินสิทธิ์ แจ้งเตือน และสรุปงานตามคน
 *    (แผง "งานตามผู้รับผิดชอบ" บนหน้าภาพรวมงาน) — ลืมเลือกแล้วงานจะไปกองที่ "ยังไม่มอบหมาย"
 * ⚠️ ยังใช้สี/ขอบ/มุมโค้งชุดเดียวกับทั้งฟอร์ม แค่พื้นอมแดงจางๆ — เด่นแต่ไม่แปลกแยก
 *
 * @param value    ชื่อ (fname) ที่เลือกอยู่ — "" = ยังไม่ระบุ
 * @param onChange (name) => void
 * @param options  รายชื่อที่เลือกได้ (fname)
 * @param employees ข้อมูลพนักงาน (ใช้รูปโปรไฟล์/ชื่อเต็ม/ตำแหน่ง)
 */
const ACCENT = "#dc2626";
const colorOf = personColor;
const initialOf = personInitial;

export default function ResponsiblePicker({ value, onChange, options = [], employees = [], helperText }) {
  const byName = useMemo(() => {
    const m = new Map();
    employees.forEach((e) => { if (e?.fname && !m.has(e.fname)) m.set(e.fname, e); });
    return m;
  }, [employees]);
  const person = value ? byName.get(value) : null;
  const avatarOf = (name) => (hasValidAvatar(byName.get(name)?.imageUrl) ? byName.get(name).imageUrl : undefined);
  const subOf = (name) => {
    const e = byName.get(name);
    return [e?.lname ? `${e.fname} ${e.lname}` : "", e?.jobTitle || ""].filter(Boolean).join(" · ");
  };

  return (
    <Box sx={{
      display: "flex", alignItems: { xs: "stretch", sm: "center" }, flexDirection: { xs: "column", sm: "row" }, gap: 1.5,
      p: 1.5, borderRadius: 2.5, border: "1px solid", borderColor: value ? alpha(ACCENT, 0.28) : alpha(ACCENT, 0.2),
      bgcolor: alpha(ACCENT, value ? 0.045 : 0.025), transition: "background-color .15s, border-color .15s",
    }}>
      <Stack direction="row" alignItems="center" gap={1.25} sx={{ minWidth: { sm: 210 } }}>
        {value ? (
          <Avatar src={avatarOf(value)} sx={{ width: 40, height: 40, bgcolor: colorOf(value), fontWeight: 800, boxShadow: `0 0 0 2px #fff, 0 0 0 3px ${alpha(ACCENT, 0.35)}` }}>
            {initialOf(value)}
          </Avatar>
        ) : (
          <Avatar sx={{ width: 40, height: 40, bgcolor: alpha(ACCENT, 0.1), color: ACCENT }}>
            <ManageAccounts sx={{ fontSize: 22 }} />
          </Avatar>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: "0.88rem", color: ACCENT, lineHeight: 1.3 }}>ผู้รับผิดชอบงาน</Typography>
          <Typography noWrap sx={{ fontSize: "0.74rem", color: "#64748b" }}>
            {value ? (subOf(value) || "ติดตามงานนี้ทั้งหมด") : "ยังไม่ได้มอบหมาย"}
          </Typography>
        </Box>
      </Stack>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Autocomplete
          size="small" fullWidth options={options}
          value={value || null}
          onChange={(_, v) => onChange(v || "")}
          noOptionsText="ไม่พบพนักงาน"
          renderOption={(props, name) => {
            const { key, ...rest } = props;
            return (
              <Box component="li" key={key} {...rest} sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                <Avatar src={avatarOf(name)} sx={{ width: 28, height: 28, bgcolor: colorOf(name), fontSize: "0.8rem", fontWeight: 700 }}>{initialOf(name)}</Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.86rem", fontWeight: 600 }}>{name}</Typography>
                  {subOf(name) && <Typography noWrap sx={{ fontSize: "0.7rem", color: "#64748b" }}>{subOf(name)}</Typography>}
                </Box>
              </Box>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="เลือกผู้รับผิดชอบ"
              helperText={helperText}
              sx={{ "& .MuiOutlinedInput-root": { bgcolor: "#fff", borderRadius: 2 } }}
              InputProps={{
                ...params.InputProps,
                startAdornment: !value ? <PersonOutline sx={{ fontSize: 18, color: "text.disabled", ml: 0.5 }} /> : params.InputProps.startAdornment,
              }}
            />
          )}
        />
        {person === undefined && value && (
          <Typography sx={{ fontSize: "0.7rem", color: "#b45309", mt: 0.5 }}>ชื่อนี้ไม่อยู่ในรายชื่อพนักงานปัจจุบัน</Typography>
        )}
      </Box>
    </Box>
  );
}
