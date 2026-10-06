import { createTheme } from "@mui/material/styles";

/**
 * theme.js — ธีม MUI ของทั้งแอป
 *
 * ⚠️ ทำไมต้องมีไฟล์นี้ (เดิมแอปไม่เคยมี ThemeProvider เลย): MUI ตั้ง font-family เป็น Roboto ไว้บน
 * "class ของคอมโพเนนต์ตัวเอง" (.MuiTypography-root, .MuiButton-root ฯลฯ) ซึ่งมี specificity สูงกว่ากฎ
 * `* { font-family }` ใน index.css — ผลคือถึงจะตั้งฟอนต์รวมไว้แล้ว คอมโพเนนต์ MUI (ซึ่งเป็นเกือบทั้งแอป:
 * ปุ่ม/ตาราง/ชิป/ป้าย/กล่องข้อความ) ก็ยังใช้ Roboto อยู่ดี กลายเป็นในหน้าเดียวมีฟอนต์ปนกัน 2-3 แบบ
 * ✅ บอก MUI ให้ใช้ฟอนต์ชุดเดียวกับ index.css (อ่านจาก CSS variable --app-font ตัวเดียวกัน จะได้ไม่มีทาง
 * หลุดไม่ตรงกันเวลาเปลี่ยนฟอนต์ทีหลัง — แก้ที่ index.css ที่เดียวมีผลทั้งสองระบบ)
 */

// ⚠️ ต้องเขียนค่า fallback ซ้ำไว้ด้วย ไม่ใช้ var() เปล่าๆ — MUI เอาค่านี้ไปใส่ใน inline style/emotion
// บางจุดที่ CSS variable ยังไม่ถูก resolve (เช่นตอน SSR/สร้าง class ล่วงหน้า) ถ้าไม่มี fallback จะกลาย
// เป็นค่าว่างแล้วตกไปใช้ฟอนต์ของเบราว์เซอร์แทน
const FONT_STACK =
  'var(--app-font, "IBM Plex Sans Thai", "IBM Plex Sans", "Noto Sans Thai", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)';

const theme = createTheme({
  typography: {
    fontFamily: FONT_STACK,
    // ✅ IBM Plex Sans Thai ไม่มีน้ำหนัก 800 (มีถึง 700) — ตั้ง fontWeightBold เป็น 700 ให้ตรงกับที่มีจริง
    // จุดที่โค้ดขอ 800 เบราว์เซอร์จะ map ลงมาที่ 700 ให้เอง ซึ่งยังเป็นตัวหนา "จริง" ไม่ใช่ตัวปลอมที่เบลอ
    fontWeightBold: 700,
    // ✅ ปุ่ม MUI ค่าเริ่มต้นบังคับ UPPERCASE ซึ่งไม่มีผลกับภาษาไทยเลย (ไทยไม่มีตัวพิมพ์ใหญ่/เล็ก) แต่ทำให้
    // ข้อความอังกฤษปนไทยดูไม่เข้ากัน — ปิดทั้งแอปทีเดียว ไม่ต้องใส่ textTransform:"none" ทีละปุ่มอีกต่อไป
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    // ✅ ให้ทุกจุดที่ MUI วาดพื้นหลัง/ตัวอักษรผ่าน CssBaseline ใช้ฟอนต์เดียวกันด้วย
    MuiCssBaseline: {
      styleOverrides: {
        body: { fontFamily: FONT_STACK },
      },
    },
    // ✅ กล่องโต้ตอบบนมือถือ: ห่างขอบจอ 12px (MUI ตั้ง 32px — บนจอ 360px กินไป 18% ของความกว้าง ผู้ใช้แจ้ง
    //    "ระยะย่นจากขอบจอมากไป") · ⚠️ ไม่แตะกล่องแบบเต็มจอ (fullScreen) ที่ไม่มีขอบอยู่แล้ว
    MuiDialog: {
      styleOverrides: {
        paper: {
          "@media (max-width: 600px)": {
            "&:not(.MuiDialog-paperFullScreen)": {
              margin: 12,
              width: "calc(100% - 24px)",
              maxWidth: "calc(100% - 24px)",
              maxHeight: "calc(100% - 24px)",
            },
          },
        },
      },
    },
    // ✅ ตัวแบ่งหน้าทั้งแอปหน้าตาเดียวกัน (ผู้ใช้สั่ง 2 ต.ค. 2569 "ตัวแบ่งหน้าทั้งหมดไม่สวย ปรับให้เข้าธีม")
    //    โทนเทา-น้ำเงินเข้มตามกฎออกแบบ (สีน้อย): ปุ่มเลขพื้นขาวขอบเทาอ่อน · หน้าปัจจุบันพื้นเข้มตัวขาว ·
    //    ไม่มีวงกลมสีน้ำเงินของ MUI — ⚠️ ตั้งที่ธีมจุดเดียว ทุกหน้าที่ใช้ <Pagination>/<TablePagination> ได้ผลเหมือนกัน
    MuiPagination: {
      defaultProps: { shape: "rounded" },
      styleOverrides: {
        ul: { gap: 4, flexWrap: "nowrap" },
      },
    },
    MuiPaginationItem: {
      styleOverrides: {
        root: {
          minWidth: 34, height: 34, margin: 0, borderRadius: 8, fontWeight: 700, fontSize: "0.84rem",
          color: "#334155", border: "1px solid #e2e8f0", backgroundColor: "#fff",
          fontVariantNumeric: "tabular-nums",
          "&:hover": { backgroundColor: "#f8fafc", borderColor: "#cbd5e1" },
          "&.Mui-selected, &.Mui-selected:hover, &.Mui-selected.Mui-focusVisible": {
            // ✅ หน้าที่เลือก = ฟ้าอ่อนตัวน้ำเงิน (ผู้ใช้ไม่เอาพื้นเข้มทึบ)
            backgroundColor: "#eff6ff", borderColor: "#bfdbfe", color: "#1d4ed8",
          },
          "&.Mui-disabled": { opacity: 0.35 },
        },
        ellipsis: { border: 0, backgroundColor: "transparent", minWidth: 20 },
        sizeSmall: { minWidth: 30, height: 30, fontSize: "0.78rem" },
        sizeLarge: { minWidth: 38, height: 38, fontSize: "0.9rem" },
        icon: { fontSize: "1.15rem" },
      },
    },
    MuiTablePagination: {
      styleOverrides: {
        root: { color: "#64748b", borderTop: "1px solid #e2e8f0" },
        selectLabel: { fontSize: "0.78rem" },
        displayedRows: { fontSize: "0.78rem", fontVariantNumeric: "tabular-nums" },
        actions: {
          "& .MuiIconButton-root": { border: "1px solid #e2e8f0", borderRadius: 8, width: 32, height: 32, marginLeft: 4, color: "#334155" },
          "& .MuiIconButton-root.Mui-disabled": { opacity: 0.35 },
        },
      },
    },
  },
});

export default theme;
