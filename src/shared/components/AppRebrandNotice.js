/**
 * แถบแจ้ง "แอปเปลี่ยนชื่อ/ไอคอนแล้ว" สำหรับคนที่ติดตั้งแอปลงเครื่องไว้ก่อนหน้า
 *
 * 🐛 ปัญหาที่แก้ (ผู้ใช้แจ้ง: "แอพที่ถูกลงเครื่อง ไม่อัพก็ไม่เปลี่ยน ผู้ใช้ไม่รู้"):
 * ไอคอน/ชื่อบนหน้าจอโฮมไม่ได้อ่านจากเว็บทุกครั้งที่เปิด — ระบบปฏิบัติการจำค่าไว้ตั้งแต่ตอนติดตั้ง
 *   • Android (Chrome): อ่าน manifest ซ้ำเป็นระยะแล้วอัปเดตไอคอนให้เอง แต่กินเวลาเป็นวันถึงสัปดาห์
 *   • iOS (เพิ่มไปหน้าจอโฮม): ไม่อัปเดตให้เลย ต้องลบไอคอนเดิมแล้วเพิ่มใหม่เท่านั้น
 * ✅ จึงต้องบอกผู้ใช้ตรงๆ ในแอป พร้อมวิธีทำ — ไม่ใช่ปล่อยให้เดาเองว่าทำไมไอคอนไม่ตรงกับในแอป
 *
 * ⚠️ ขึ้นเฉพาะคนที่เปิดจาก "แอปที่ติดตั้งแล้ว" (display-mode: standalone) — คนเปิดผ่านเบราว์เซอร์
 * เห็นไอคอนใหม่บนแท็บอยู่แล้ว ไม่ต้องรบกวน
 * ⚠️ ปิดแล้วจำถาวร (localStorage) — ห้ามเด้งซ้ำทุกครั้งที่เปิดแอป
 */
import { useEffect, useState } from "react";
import { Alert, Box, Button, Collapse, Stack, Typography } from "@mui/material";
import { InstallMobile } from "@mui/icons-material";

const ACK_KEY = "app.rebrand.planngan.ack";

/** เปิดจากแอปที่ติดตั้งไว้ (ไม่ใช่แท็บเบราว์เซอร์) หรือเปล่า */
const isInstalledApp = () => {
  try {
    return window.matchMedia?.("(display-mode: standalone)")?.matches
      || window.navigator.standalone === true;   // iOS Safari ใช้ค่านี้แทน
  } catch {
    return false;
  }
};

const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key, value) => { try { localStorage.setItem(key, value); } catch { /* โหมดส่วนตัวเขียนไม่ได้ ไม่ใช่เรื่องคอขาดบาดตาย */ } };

export default function AppRebrandNotice() {
  const [show, setShow] = useState(false);
  const [howTo, setHowTo] = useState(false);

  useEffect(() => {
    if (!read(ACK_KEY) && isInstalledApp()) setShow(true);
  }, []);

  const dismiss = () => {
    write(ACK_KEY, "1");
    setShow(false);
  };

  if (!show) return null;

  return (
    <Box sx={{ px: { xs: 1.25, sm: 2 }, pt: 1.25 }}>
      <Alert
        severity="info"
        icon={<InstallMobile fontSize="inherit" />}
        sx={{ borderRadius: 2.5, alignItems: "flex-start" }}
        action={
          <Stack direction="row" spacing={0.5}>
            <Button size="small" onClick={() => setHowTo((v) => !v)} sx={{ textTransform: "none", fontWeight: 700 }}>
              {howTo ? "ซ่อนวิธีทำ" : "วิธีทำ"}
            </Button>
            <Button size="small" color="inherit" onClick={dismiss} sx={{ textTransform: "none", fontWeight: 700 }}>
              รับทราบ
            </Button>
          </Stack>
        }
      >
        <Typography sx={{ fontWeight: 800, fontSize: "0.9rem" }}>
          แอปเปลี่ยนชื่อเป็น “PlanNgan (แผนงาน)” พร้อมไอคอนใหม่แล้ว
        </Typography>
        <Typography variant="caption" sx={{ display: "block", color: "text.secondary" }}>
          ถ้าไอคอนบนหน้าจอโฮมยังเป็นอันเดิม ไม่ได้แปลว่าแอปไม่อัปเดต — ข้างในเป็นเวอร์ชันล่าสุดเสมอ
          เพราะหน้าจอโฮมจำรูปไว้ตั้งแต่ตอนติดตั้ง
        </Typography>
        <Collapse in={howTo}>
          <Box component="ol" sx={{ pl: 2.5, mt: 1, mb: 0, fontSize: "0.85rem", lineHeight: 1.75 }}>
            <li>กดค้างที่ไอคอนแอปบนหน้าจอโฮม แล้วเลือก “ลบ / นำออก” (ข้อมูลการใช้งานไม่หาย — อยู่บนเซิร์ฟเวอร์)</li>
            <li>เปิดเว็บนี้ในเบราว์เซอร์อีกครั้ง</li>
            <li>iPhone: กดปุ่มแชร์ → “เพิ่มไปยังหน้าจอโฮม” · Android: เมนู ⋮ → “ติดตั้งแอป / เพิ่มลงในหน้าจอหลัก”</li>
          </Box>
        </Collapse>
      </Alert>
    </Box>
  );
}
