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

// 🎨 (1 พ.ย. 2569 ผู้ใช้: "อยากได้ UX UI สะอาดตาแบบ Agoda · ทุกหน้าให้ใช้ธีมนี้แนวเดียวกัน")
//    ตั้งที่ธีมจุดเดียว → ทุกหน้าที่ใช้คอมโพเนนต์ MUI ได้หน้าตาเดียวกัน:
//    การ์ดไม่มีเงา ใช้เส้นขอบบาง #e6e9ef · ปุ่มไม่มีเงา · ช่องกรอกเส้นบาง
// ⚠️ ห้ามตั้ง shape.borderRadius — ค่านี้เป็น "ตัวคูณ" ของ sx={{ borderRadius: n }} ทั้งแอป (ค่าเดิม 4)
//    เคยตั้ง 12 แล้ว borderRadius: 3 กลายเป็น 36px ทุกหน้า โค้งเกินไปหมด (ผู้ใช้: "กลมมนไปทั้งหมด")
//    มุมโค้งของการ์ด/ปุ่ม/ช่องกรอก ตั้งเป็น px ตรงๆ ที่คอมโพเนนต์ด้านล่างแทน
const LINE = "#e6e9ef";

const theme = createTheme({
  // สีหลักของคอมโพเนนต์ MUI (ปุ่มบันทึก/ยืนยัน · สวิตช์ · ช่องติ๊ก) = ฟ้า — ผู้ใช้: "ปุ่มบันทึกควรเป็นสีน้ำเงินฟ้าทั้งหมด"
  //    แดงแบรนด์ใช้กับแถบบน · เมนูข้าง · แท็บ/เมนูที่เลือก · ป้ายงานค้าง (ตั้งที่คอมโพเนนต์เหล่านั้นเอง)
  palette: { primary: { main: "#2563eb", dark: "#1d4ed8", light: "#3b82f6", contrastText: "#fff" } },
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
    // การ์ด/กล่อง (Paper elevation 1–3 = การ์ดในหน้า) → เส้นขอบบางแทนเงา · เมนู/ป๊อปอัป (elevation สูง) ยังมีเงาให้ลอยเหนือหน้า
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 12 },
        elevation1: { boxShadow: "none", border: `1px solid ${LINE}` },
        elevation2: { boxShadow: "none", border: `1px solid ${LINE}` },
        elevation3: { boxShadow: "none", border: `1px solid ${LINE}` },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 700 },
        // 🎨 (1 พ.ย. 2569 ผู้ใช้: "สีสันให้มีเฉด อิงธีมหน้าแรก") ปุ่มทึบทุกสีมีเฉดอ่อนๆ — สว่างมุมซ้ายบน เข้มมุมขวาล่าง
        //    แบบเดียวกับไอคอนหน้าแรก (ซ้อนเป็น background-image บนสีที่แต่ละหน้าตั้งไว้ สีเดิมของปุ่มไม่เปลี่ยน)
        contained: {
          backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.10) 100%)",
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 8, "& .MuiOutlinedInput-notchedOutline": { borderColor: LINE } },
      },
    },
    // ป้ายสถานะสี่เหลี่ยมมุมโค้งเล็กแบบ Agoda (หลักสี: ฟ้า=เลือก/ข้อมูล · แดง=ด่วน · เขียว=สำเร็จ)
    MuiChip: { styleOverrides: { root: { fontWeight: 600, borderRadius: 6 } } },
    // ✅ (25 ต.ค. 2569 ผู้ใช้: "หน่วง กระตุก ไม่สมูท") มือถือ/จอสัมผัส: ปิดคลื่นริปเปิลของ MUI
    //    ริปเปิลสร้างคอมโพเนนต์ + แอนิเมชันใหม่ทุกครั้งที่แตะ (ตรงจังหวะที่หน้าต่างกำลังเปิด) และทุกปุ่มต้องวาดตัวริปเปิลติดไว้
    //    → แตะแล้วจางลงเล็กน้อยแบบแอปมือถือแทน (CSS ล้วน ไม่มี JS) · จอคอมยังมีริปเปิลตามเดิม
    MuiButtonBase: {
      defaultProps: {
        disableRipple: typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches,
      },
      styleOverrides: {
        root: {
          "@media (pointer: coarse)": {
            transition: "opacity .12s ease",
            "&:active": { opacity: 0.6 },
          },
        },
      },
    },
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
          color: "#334155", border: "1px solid #e6e9ef", backgroundColor: "#fff",
          fontVariantNumeric: "tabular-nums",
          "&:hover": { backgroundColor: "#f8fafc", borderColor: "#cbd5e1" },
          "&.Mui-selected, &.Mui-selected:hover, &.Mui-selected.Mui-focusVisible": {
            // ✅ หน้าที่เลือก = ฟ้าอ่อนตัวน้ำเงิน (ผู้ใช้ไม่เอาพื้นเข้มทึบ)
            backgroundColor: "#fef2f2", borderColor: "#fecaca", color: "#b91c1c",
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
        root: { color: "#64748b", borderTop: "1px solid #e6e9ef" },
        selectLabel: { fontSize: "0.78rem" },
        displayedRows: { fontSize: "0.78rem", fontVariantNumeric: "tabular-nums" },
        actions: {
          "& .MuiIconButton-root": { border: "1px solid #e6e9ef", borderRadius: 8, width: 32, height: 32, marginLeft: 4, color: "#334155" },
          "& .MuiIconButton-root.Mui-disabled": { opacity: 0.35 },
        },
      },
    },
  },
});

export default theme;
