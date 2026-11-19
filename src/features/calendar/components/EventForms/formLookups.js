/**
 * formLookups — ข้อมูลประกอบฟอร์มลงงาน/แก้ไขงาน (ลูกค้า · พนักงาน · ประเภทงาน · ระบบ)
 *
 * ✅ (19 พ.ย. 2569 ผู้ใช้: "เวลากดเปิดงาน หรือกดจะเพิ่มงานในปฏิทิน มันจะหน่วงช้า")
 *    เดิมทุกครั้งที่แตะงาน/แตะวัน ฟอร์มรอเน็ต 4 คำขอ (รายชื่อลูกค้าทั้งหมด · พนักงาน · ประเภทงาน · ระบบ)
 *    ก่อนจะเริ่มสร้างหน้าจอ — บนมือถือเน็ตช้าคือรอ 0.5–2 วินาทีโดยไม่มีอะไรขึ้นเลย
 *    → เก็บไว้ในหน่วยความจำ + ดึงล่วงหน้าตอนเปิดปฏิทิน · แตะแล้วใช้ของที่มีอยู่ทันที
 *    → ของเก่ากว่า FRESH_MS = ใช้ไปก่อน แล้วดึงใหม่เบื้องหลัง (ครั้งถัดไปได้ข้อมูลล่าสุด)
 *
 * ⚠️ ข้อมูลเก่าได้ไม่กี่วินาทีไม่ทำให้ฟอร์มผิด — ฟอร์มแก้ไขเติมค่าปัจจุบันของงานเป็นตัวเลือกให้เองเสมอ
 *    (customOption ใน EditEvent.js) และช่องพิมพ์ค่าใหม่ได้ (TomSelect create) · หลังบันทึก/เพิ่มประเภทใหม่
 *    เรียก refreshFormLookups() ให้ดึงใหม่ทันที
 * ⚠️ ส่ง service เข้ามาเป็นพารามิเตอร์ (ฟอร์มรับ service จากหน้าแม่) — แคชผูกกับชุด service ที่ใช้ดึง
 *    ชุดอื่น (เช่น ตัวจำลองในเทสต์) จะไม่ได้ข้อมูลข้ามชุดกัน
 */

const FRESH_MS = 30_000;

let cache = null; // { at, key, data: { customers, employees, jobTypes, systemTypes } }
let inflight = null; // { key, promise }

const keyOf = (svc) => svc?.CustomerService;

const fetchAll = (svc) => {
  const key = keyOf(svc);
  if (inflight && inflight.key === key) return inflight.promise;
  const promise = Promise.all([
    svc.CustomerService.getCustomers(),
    svc.AuthService.getAllUserData(),
    svc.JobTypeService.getAll(),
    svc.SystemTypeService.getAll(),
  ])
    .then(([customers, employees, jobTypes, systemTypes]) => {
      cache = { at: Date.now(), key, data: { customers, employees, jobTypes, systemTypes } };
      return cache.data;
    })
    .finally(() => {
      if (inflight?.promise === promise) inflight = null;
    });
  inflight = { key, promise };
  return promise;
};

/** มีข้อมูลพร้อมใช้ทันที (ไม่ต้องรอเน็ต) หรือไม่ */
export const hasFormLookups = (svc) => Boolean(cache && cache.key === keyOf(svc));

/**
 * ข้อมูลสำหรับสร้างฟอร์ม — มีในหน่วยความจำ = คืนทันที (เก่า = ดึงใหม่เบื้องหลัง) · ยังไม่มี = รอดึง
 * @returns {Promise<{ customers, employees, jobTypes, systemTypes }>}
 */
export const getFormLookups = async (svc) => {
  if (hasFormLookups(svc)) {
    if (Date.now() - cache.at > FRESH_MS) fetchAll(svc).catch(() => {});
    return cache.data;
  }
  return fetchAll(svc);
};

/** ดึงเก็บไว้ล่วงหน้า (เงียบ · ไม่ซ้ำถ้ายังสดอยู่หรือกำลังดึง) — เรียกตอนเปิดปฏิทิน/กลับมาที่แท็บ */
export const prefetchFormLookups = (svc) => {
  if (hasFormLookups(svc) && Date.now() - cache.at <= FRESH_MS) return;
  fetchAll(svc).catch(() => {});
};

/** ข้อมูลเปลี่ยนแน่ๆ (บันทึกงาน/เพิ่มประเภทงานใหม่) — ดึงใหม่เบื้องหลังทันที ครั้งถัดไปได้ค่าล่าสุด */
export const refreshFormLookups = (svc) => {
  if (cache) cache.at = 0;
  fetchAll(svc).catch(() => {});
};

/** ✅ กล่อง "กำลังเปิด…" แสดงทันทีที่แตะ ระหว่างรอข้อมูลครั้งแรก (ยังไม่มีในหน่วยความจำ) — ไม่ให้ดูเหมือนแตะไม่ติด */
export const showOpeningLoader = (Swal, text = "กำลังเปิด…") => {
  Swal.fire({
    title: text, allowOutsideClick: false, allowEscapeKey: false, showConfirmButton: false, buttonsStyling: false,
    didOpen: () => Swal.showLoading(),
  });
};
