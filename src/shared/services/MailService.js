/**
 * MailService — ส่งเอกสาร PDF ทางอีเมลจากในแอป (da-app-server/src/routes/mail.js)
 *
 * ✅ ผู้ใช้สั่ง (3 ต.ค. 2569): "เพิ่มระบบส่งอีเมลของเอกสารต่างๆ ให้สามารถแก้ไขรายละเอียดที่จะส่งได้ด้วย"
 * ⚠️ PDF สร้างที่เบราว์เซอร์ (ไฟล์เดียวกับที่พิมพ์/ดาวน์โหลด) แล้วอัปโหลดไปให้ server ส่งต่อ
 */
import API from "@/shared/api/axiosInstance";
import CustomerService from "@/shared/services/CustomerService";
import StaffDirectoryService from "@/shared/services/StaffDirectoryService";

let statusCache;
let contactsCache;
let customersCache;

const MailService = {
  /** @returns {Promise<{configured: boolean, from: string, maxRecipients: number, maxMb: number}>} */
  async status({ force = false } = {}) {
    if (!force && statusCache) return statusCache;
    try {
      const { data } = await API.get("/mail/status");
      statusCache = data;
    } catch {
      // ⚠️ เช็คสถานะไม่ได้ (เน็ตหลุด/server รุ่นเก่า) = ยังให้ลองส่งได้ server จะตอบเหตุผลเอง
      return { configured: true, from: "", maxRecipients: 10, maxMb: 10, unknown: true };
    }
    return statusCache;
  },

  /**
   * @param {{ file: Blob, fileName: string, to: string[], cc?: string[], subject: string, body: string,
   *           docType?: string, docNo?: string, refId?: string, copyMe?: boolean }} p
   */
  async sendDocument({ file, fileName, to, cc = [], subject, body, docType = "", docNo = "", refId = "", copyMe = false }) {
    const fd = new FormData();
    fd.append("file", file, fileName);
    fd.append("to", to.join(","));
    fd.append("cc", cc.join(","));
    fd.append("subject", subject);
    fd.append("body", body);
    fd.append("docType", docType);
    fd.append("docNo", docNo);
    fd.append("refId", refId);
    fd.append("copyMe", copyMe ? "1" : "0");
    // ⚠️ SMTP + ไฟล์แนบใช้เวลาได้หลายวินาที — เผื่อเวลาให้มากกว่าคำขอปกติ
    // ⚠️ ต้องตั้ง multipart เอง — axiosInstance ตั้ง Content-Type เป็น JSON ไว้ทั้งแอป (ไม่ตั้ง = server ไม่เห็นไฟล์)
    const { data } = await API.post("/mail/document", fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 60_000 });
    return data;
  },

  async log({ refId, docNo }) {
    if (!refId && !docNo) return [];
    try {
      const { data } = await API.get("/mail/log", { params: { refId, docNo } });
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  /**
   * อีเมลลูกค้าจากทะเบียน ตามบริษัท + โครงการของเอกสาร (ตรงทั้งคู่ก่อน แล้วค่อยบริษัทอย่างเดียว)
   * @returns {string[]}
   */
  customerEmailFor(list, { company, site } = {}, customer) {
    if (customer?.cEmail) return [customer.cEmail];
    const norm = (v) => String(v || "").trim().toLowerCase();
    const rows = (Array.isArray(list) ? list : []).filter((c) => c?.cEmail);
    const found = rows.find((c) => norm(c.cSite) === norm(site) && norm(c.cCompany) === norm(company))
      || (company ? rows.find((c) => norm(c.cCompany) === norm(company)) : null)
      || (site ? rows.find((c) => norm(c.cSite) === norm(site)) : null);
    return found ? [found.cEmail] : [];
  },

  /**
   * รายชื่ออีเมลที่แนะนำในช่องผู้รับ — ลูกค้าที่มีอีเมลในทะเบียน + พนักงาน
   * @returns {Promise<Array<{email: string, label: string, group: string}>>}
   */
  async customers() {
    if (customersCache) return customersCache;
    const res = await CustomerService.getCustomers().catch(() => null);
    const list = res?.userCustomers || res?.customers || res?.data || (Array.isArray(res) ? res : []);
    customersCache = Array.isArray(list) ? list : [];
    return customersCache;
  },

  async contacts() {
    if (contactsCache) return contactsCache;
    const [list, staff] = await Promise.all([
      MailService.customers(),
      StaffDirectoryService.list().catch(() => []),
    ]);
    const seen = new Set();
    const out = [];
    const push = (email, label, group) => {
      const e = String(email || "").trim().toLowerCase();
      if (!e || !e.includes("@") || seen.has(e)) return;
      seen.add(e);
      out.push({ email: e, label: String(label || "").trim(), group });
    };
    list.forEach((c) => push(c.cEmail, [c.cName, c.cCompany || c.cSite].filter(Boolean).join(" · "), "ลูกค้า"));
    (staff || []).forEach((s) => push(s.email, [s.name, s.position].filter(Boolean).join(" · "), "พนักงาน"));
    contactsCache = out;
    return out;
  },
};

export default MailService;
