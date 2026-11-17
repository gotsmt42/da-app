/**
 * UserAvatar — รูปผู้ใช้จริง (ถ้ามี) ไม่งั้นตัวอักษรแรกบนสีประจำคน · ที่เดียวทั้งแอป
 *
 * ✅ (17 พ.ย. 2569 ผู้ใช้: "ควรเอารูป user จริงมาแสดง") ใช้ในทะเบียนพนักงาน · ภาระงานทีมช่าง · หน้าแรก · รายงาน
 *    รูปเสีย/ลิงก์ว่าง (hasValidAvatar) → แสดงตัวอักษรแทน ไม่โชว์กรอบรูปแตก
 * @param name   ชื่อที่ใช้ทำตัวอักษร/สี
 * @param src    url รูป (imageUrl ของผู้ใช้)
 * @param user   ส่งผู้ใช้ทั้งก้อนแทน name/src ได้ ({ fname, lname, imageUrl })
 */
import { Avatar } from "@mui/material";
import { personColor, personInitial } from "@/shared/utils/personAvatar";
import { hasValidAvatar } from "@/shared/utils/user";

export default function UserAvatar({ name, src, user, size = 34, variant, sx }) {
  const label = name || [user?.fname, user?.lname].filter(Boolean).join(" ") || user?.username || "";
  const url = src ?? user?.imageUrl;
  return (
    <Avatar src={hasValidAvatar(url) ? url : undefined} variant={variant} alt={label}
      sx={{ width: size, height: size, fontSize: size * 0.4, fontWeight: 800, bgcolor: personColor(label), flexShrink: 0, ...sx }}>
      {personInitial(label)}
    </Avatar>
  );
}
