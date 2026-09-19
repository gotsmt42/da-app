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
  /** โลโก้บนหัวเว็บ (พื้นเข้ม) · หน้าเข้าสู่ระบบใช้ตัวเดียวกัน */
  logoUrl: "/logo-dark-2.png",
  /** โลโก้หัวกระดาษ — ไฟล์ที่ตัดขอบว่างแล้ว (ดูเหตุผลใน deliveryNotePdf.js) */
  letterheadUrl: "/logo-letterhead.png",
  stampUrl: "/stamp.png",
  advanceClearDays: 7,
  /** ชื่อ Rank (ตำแหน่งในองค์กร) ที่ตั้งเอง { rank: "ชื่อ" } — ว่าง = ใช้ชื่อเริ่มต้นของระบบ */
  rankLabels: {},
};

/** เติมค่าเริ่มต้นให้ช่องที่ยังไม่ได้ตั้ง — หน้าจอจะได้ไม่ต้องเช็ค null เอง */
const withFallback = (s) => ({
  ...ORG_FALLBACK,
  ...Object.fromEntries(Object.entries(s || {}).filter(([, v]) => v !== "" && v !== null && v !== undefined)),
});

let cache;
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
