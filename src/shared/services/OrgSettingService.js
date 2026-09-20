/**
 * OrgSettingService — ตั้งค่าองค์กร (โลโก้ · ข้อมูลบริษัท · ค่าตั้งต้นเอกสาร)
 *
 * ✅ ผู้ใช้สั่ง: "หน้าการตั้งค่า อยากให้ปรับเปลี่ยนได้เอง เช่น Logo แอพ / การแสดงผลต่างๆ"
 * ค่าจากที่นี่ถูกใช้ 3 ที่: โลโก้บนหัวเว็บ · หน้าเข้าสู่ระบบ · หัวกระดาษ/ตราประทับของ PDF ทุกใบ
 *
 * ⚠️ แคชระดับโมดูล — ทุกหน้าจออ่านค่าเดียวกัน ยิง API ครั้งเดียวต่อการเปิดแอป
 * ⚠️ ดึงไม่สำเร็จต้องไม่ทำให้แอปพัง: คืนค่าเริ่มต้น (โลโก้/ชื่อบริษัทที่ติดมากับแอป) เสมอ
 */
import API from "@/shared/api/axiosInstance";
import { setRankLabels } from "@/shared/utils/roles";

/**
 * ค่าที่ติดมากับแอป — ใช้เมื่อยังไม่ได้ตั้งค่าเอง หรือดึงค่าจากเซิร์ฟเวอร์ไม่ได้
 * ✅ รองรับการนำไปใช้กับองค์กรอื่น: ตั้ง REACT_APP_ORG_* ตอน build ก็ได้ชื่อบริษัทนั้นทันที
 * ⚠️ ค่าจริงมาจาก /settings เสมอ — ชุดนี้ใช้แค่ตอนที่ยังติดต่อเซิร์ฟเวอร์ไม่ได้
 */
const orgEnv = (key, fallback = "") => String(import.meta.env[key] || "").trim() || fallback;

export const ORG_FALLBACK = {
  nameTh: orgEnv("REACT_APP_ORG_NAME_TH", "องค์กรของคุณ"),
  nameEn: orgEnv("REACT_APP_ORG_NAME_EN", "YOUR ORGANIZATION"),
  address: orgEnv("REACT_APP_ORG_ADDRESS", ""),
  taxId: orgEnv("REACT_APP_ORG_TAX_ID", ""),
  tel: "",
  email: "",
  website: "",
  /**
   * โลโก้บนหัวเว็บ · หน้าเข้าสู่ระบบ
   * ✅ ค่าเริ่มต้น = โลโก้ของ "แอป" (Flowix) ไม่ใช่โลโก้บริษัทใดบริษัทหนึ่ง — องค์กรที่เพิ่งติดตั้ง
   * จะได้แบรนด์ของแอปไปก่อน แล้วค่อยอัปโหลดโลโก้ตัวเอง หรือกดเลือกชุดที่ติดมากับแอปทับได้
   * ⚠️ ชุดเดิมของ DO ALL ยังอยู่ครบทุกไฟล์ — เลือกกลับมาใช้ได้ 1 คลิกจากหน้า "ตั้งค่าองค์กร"
   */
  logoUrl: "/app-wordmark-light.png",
  /** โลโก้หัวกระดาษ — ไฟล์ที่ตัดขอบว่างแล้ว (ดูเหตุผลใน deliveryNotePdf.js) */
  letterheadUrl: "/logo-letterhead.png",
  stampUrl: "/stamp.png",
  /**
   * ช่องทางติดต่อแบบแชต/โซเชียล — ตั้งที่หน้า "องค์กรและเอกสาร" (Super Admin)
   * ⚠️ เบอร์โทร/อีเมล/เว็บไซต์ ใช้ tel/email/website ด้านบนร่วมกัน ไม่ได้แยกเก็บอีกชุด
   */
  contactLine: "",
  contactFacebook: "",
  advanceClearDays: 7,
  /** ชื่อ Rank (ตำแหน่งในองค์กร) ที่ตั้งเอง { rank: "ชื่อ" } — ว่าง = ใช้ชื่อเริ่มต้นของระบบ */
  rankLabels: {},
};

/**
 * ชุดโลโก้ของแอป (Flowix) — มีหลายแบบเพราะพื้นหลังแต่ละที่ไม่เหมือนกัน
 * ⚠️ ไฟล์ PNG มีสีตัวอักษรตายตัว จึงต้องเลือกให้ตรงพื้น ไม่งั้นตัวหนังสือจมหายไปกับพื้น
 */
export const APP_LOGO = {
  wordmarkLight: "/app-wordmark-light.png",    // แนวนอน ตัวหนังสือขาว — หัวเว็บพื้นเข้ม
  wordmarkDark: "/app-wordmark-dark.png",      // แนวนอน ตัวหนังสือเข้ม — การ์ดพื้นขาว
  stackedLight: "/app-logo-stacked-light.png", // เรียงแนวตั้ง ตัวหนังสือขาว — แผงใหญ่พื้นเข้ม
  stackedDark: "/app-logo-stacked-dark.png",
  icon: "/app-icon.svg",
};
const APP_LOGO_FILES = Object.values(APP_LOGO);

/**
 * โลโก้ที่ควรใช้ในบริบทนั้นๆ
 * • องค์กรตั้งโลโก้ของตัวเองไว้ (อัปโหลดเอง หรือเลือกชุด DO ALL) → ใช้ของเขาทุกที่เหมือนเดิม
 * • ยังใช้ค่าเริ่มต้นของแอปอยู่ → หยิบไฟล์ Flowix ที่เข้ากับพื้นตรงนั้นให้อัตโนมัติ
 * @param {{on?: "dark"|"light", layout?: "wordmark"|"stacked"|"icon"}} opts
 * @param {object} [settings] ค่าที่หน้าจอ subscribe อยู่ (useOrgSettings) — ส่งมาด้วยเพื่อให้
 *   เปลี่ยนโลโก้แล้วหน้าจอวาดใหม่ทันที (ถ้าอ่านจากแคชเฉยๆ React จะไม่รู้ว่ามีอะไรเปลี่ยน)
 */
export const appLogoFor = ({ on = "dark", layout = "wordmark" } = {}, settings) => {
  const current = settings?.logoUrl || cache?.logoUrl || ORG_FALLBACK.logoUrl;
  if (current && !APP_LOGO_FILES.includes(current)) return current;
  /**
   * ที่แคบมากจริงๆ — เอาเฉพาะเครื่องหมาย ไม่เอาชื่อ
   * ⚠️ แถบบนไม่ได้ใช้ทางนี้แล้ว: ผู้ใช้ยืนยันว่าต้องเห็นชื่อแอปเสมอ ("ให้มีตัวอักษรด้วย")
   * เหลือไว้สำหรับที่ที่เป็นช่องสี่เหลี่ยมจัตุรัสจริงๆ เท่านั้น
   */
  if (layout === "icon") return APP_LOGO.icon;
  if (layout === "stacked") return on === "light" ? APP_LOGO.stackedDark : APP_LOGO.stackedLight;
  return on === "light" ? APP_LOGO.wordmarkDark : APP_LOGO.wordmarkLight;
};

/**
 * ช่องทางติดต่อที่ "ตั้งค่าไว้จริง" — ใช้วาดเมนูติดต่อบนหัวเว็บ (ดู layouts/HeaderContactMenu.js)
 * ช่องไหนว่างจะไม่อยู่ในรายการ ผู้ดูแลจึงเลือกได้ว่าจะเปิดช่องทางไหนบ้างแค่ด้วยการกรอก/ลบ
 * ⚠️ กรองสคีมซ้ำอีกชั้นถึงแม้ฝั่งเซิร์ฟเวอร์กันไว้แล้ว — ค่าเหล่านี้กลายเป็น href ที่ทุกคนกด
 *    และอาจมีข้อมูลเก่าที่บันทึกไว้ก่อนมีการตรวจค้างอยู่ในฐานข้อมูล
 * ⚠️ เบอร์โทรต้องถอดอักขระที่โทรไม่ได้ออกก่อนทำ tel: (ของจริงมักพิมพ์เป็น "02-123-4567 ต่อ 101")
 *    แต่ข้อความที่แสดงยังเป็นตัวที่ผู้ดูแลพิมพ์ไว้เหมือนเดิม
 */
const httpOnly = (url) => {
  const v = String(url || "").trim();
  if (!v) return "";
  try {
    return ["http:", "https:"].includes(new URL(v).protocol) ? v : "";
  } catch {
    return "";
  }
};

export const contactChannels = (settings) => {
  const s = settings || cache || ORG_FALLBACK;
  const tel = String(s.tel || "").trim();
  const dial = tel.replace(/[^\d+]/g, "");
  const email = String(s.email || "").trim();
  const line = httpOnly(s.contactLine);
  const facebook = httpOnly(s.contactFacebook);
  const website = httpOnly(s.website);

  return [
    tel && dial && { key: "phone", label: `โทร ${tel}`, href: `tel:${dial}` },
    line && { key: "line", label: "แชตทาง LINE", href: line, external: true },
    facebook && { key: "facebook", label: "Facebook", href: facebook, external: true },
    email && email.includes("@") && { key: "email", label: email, href: `mailto:${email}` },
    website && { key: "website", label: "เว็บไซต์", href: website, external: true },
  ].filter(Boolean);
};

/** ตอนนี้ยังใช้โลโก้ของแอปอยู่ไหม (= องค์กรยังไม่ได้ตั้งของตัวเอง) */
export const isAppDefaultLogo = () => APP_LOGO_FILES.includes(cache?.logoUrl || ORG_FALLBACK.logoUrl);

/** เติมค่าเริ่มต้นให้ช่องที่ยังไม่ได้ตั้ง — หน้าจอจะได้ไม่ต้องเช็ค null เอง */
const withFallback = (s) => ({
  ...ORG_FALLBACK,
  ...Object.fromEntries(Object.entries(s || {}).filter(([, v]) => v !== "" && v !== null && v !== undefined)),
});

let cache;
let builtin = {};   // รูปที่ติดมากับแอปให้เลือก (server ส่งมาพร้อม GET /settings)
let inflight;
const listeners = new Set();

const emit = () => listeners.forEach((fn) => {
  try { fn(cache); } catch { /* ตัวฟังตัวเดียวล้มต้องไม่ลากตัวอื่น */ }
});

const OrgSettingService = {
  /** ค่าปัจจุบัน (แคชไว้) — ยังไม่โหลดจะได้ค่าเริ่มต้นไปก่อน */
  current() {
    return cache || ORG_FALLBACK;
  },

  async load({ force = false } = {}) {
    if (!force && cache) return cache;
    if (!inflight || force) {
      inflight = API.get("/settings")
        .then((res) => {
          cache = withFallback(res.data?.settings);
          builtin = res.data?.builtinImages || {};
          // ✅ ชื่อตำแหน่งที่ผู้ดูแลตั้งเอง มีผลกับทุกที่ที่แสดงชื่อสิทธิ์ทันที (rankLabel ใน roles.js)
          setRankLabels(cache.rankLabels || {});
          emit();
          return cache;
        })
        .catch(() => {
          cache = cache || ORG_FALLBACK;
          return cache;
        })
        .finally(() => { inflight = null; });
    }
    return inflight;
  },

  /**
   * ประวัติการแก้ค่าตั้งค่า (ล่าสุดอยู่หน้าสุด)
   * 🔒 เส้นทางนี้ตรวจสิทธิ์ manageSystem ฝั่งเซิร์ฟเวอร์ — มีชื่อคนแก้อยู่ในนั้น
   *    จึงไม่ได้รวมมากับ /settings ที่เปิดให้อ่านได้โดยไม่ต้องล็อกอิน
   */
  async history() {
    const res = await API.get("/settings/history");
    return res.data?.history || [];
  },

  /** รูปที่ติดมากับแอปให้เลือก — { app: [...], letterhead: [...], stamp: [...] } */
  builtinImages() {
    return builtin;
  },

  /** เลือกใช้รูปที่ติดมากับแอปแทนการอัปโหลด — ✅ ผู้ใช้ขอให้ "เลือกได้" ไม่ใช่มีชุดเดียวตายตัว */
  async applyBuiltinImage(slot, key) {
    return OrgSettingService.update({ [`preset_${slot}`]: key });
  },

  /** @param {object} fields ช่องที่แก้ (ส่งเฉพาะที่เปลี่ยน) */
  async update(fields) {
    const res = await API.put("/settings", fields);
    cache = withFallback(res.data?.settings);
    setRankLabels(cache.rankLabels || {});
    emit();
    return cache;
  },

  /** @param {"app"|"letterhead"|"stamp"} slot */
  async uploadImage(slot, file) {
    const body = new FormData();
    body.append("file", file);
    const res = await API.post(`/settings/image/${slot}`, body, { headers: { "Content-Type": "multipart/form-data" } });
    cache = withFallback(res.data?.settings);
    emit();
    return cache;
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  clearCache() {
    cache = undefined;
  },
};

export default OrgSettingService;
