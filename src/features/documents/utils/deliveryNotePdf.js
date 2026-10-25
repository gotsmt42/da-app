/**
 * deliveryNotePdf.js — "ใบส่งมอบงาน" (หนังสือส่งมอบเอกสาร/งานบริการให้ลูกค้า)
 *
 * วางเลย์เอาต์ตามแบบฟอร์มจริงของบริษัทเป๊ะๆ:
 *   [โลโก้]  ชื่อบริษัท (ไทย/อังกฤษ) · ที่อยู่สำนักงานใหญ่ · เลขประจำตัวผู้เสียภาษี
 *   เลขที่ / วันที่ / เรื่อง / โครงการ (ชื่อโครงการ + บริษัทลูกค้า + ที่อยู่)
 *   เรียน / อ้างถึง / สิ่งที่ส่งมาด้วย
 *   ย่อหน้าเนื้อความ
 *   กรอบลงนามรับเอกสาร (ฝั่งลูกค้า)  |  ขอแสดงความนับถือ + ตราประทับ (ฝั่งบริษัท)
 *
 * ⚠️ ทำไมไม่ใช้ไฟล์เดียวกับ GenPDF.js (ใบแจ้งขอเข้างาน) ทั้งที่หัวกระดาษคล้ายกัน:
 * เอกสาร 2 ตัวนี้คนละชนิดกันโดยสิ้นเชิง — ใบแจ้งขอเข้างานออก "ก่อน" เข้างาน (แจ้งกำหนดการ ไม่มี
 * เลขที่เอกสารทางการ ไม่มีกรอบลงนามรับมอบ) ส่วนใบส่งมอบงานออก "หลัง" งานเสร็จ (มีเลขที่เอกสาร
 * เดินหน้าอย่างเดียวที่ห้ามซ้ำ มีรายการสิ่งที่ส่งมาด้วย มีกรอบให้ลูกค้าเซ็นรับ) ถ้ายัดรวมไฟล์เดียวกัน
 * จะกลายเป็นฟังก์ชันที่มี if แยกทางกันตั้งแต่บรรทัดแรกจนบรรทัดสุดท้าย แก้อันหนึ่งพังอีกอันตลอด
 *
 * ⚠️ พิกัดทั้งหมดเป็นมิลลิเมตร (jsPDF unit:"mm", A4 = 210 x 297)
 */
import moment from "moment";
import "@/shared/utils/momentThaiLocale";
import { formatRoundLabel } from "@/shared/utils/contractRounds";
import { thaiDateFull } from "@/shared/utils/thaiDate";

// ── ข้อมูลบริษัทผู้ออกเอกสาร ────────────────────────────────────────────────
// ✅ รวมไว้ที่เดียว — เดิม GenPDF.js ฝังข้อความพวกนี้กระจายอยู่กลางฟังก์ชัน ย้ายที่อยู่/เบอร์ทีต้องไล่หา
import OrgSettingService from "@/shared/services/OrgSettingService";
// ✅ (17 ต.ค. 2569) ตัวหนาสำหรับหัวข้อ/ป้ายของเอกสาร (เดิมมีแค่ตัวปกติ ทุกอย่างหน้าตาเท่ากันหมด อ่านแยกส่วนยาก)
import thSarabunBold from "@/assets/fonts/THSarabunNewBold_base64";

/**
 * ข้อมูลบริษัทบนหัวกระดาษ
 * ⚠️ ค่าที่เห็นตรงนี้คือ "ค่าเริ่มต้น" เท่านั้น — ของจริงถูกทับด้วยตั้งค่าองค์กร (applyOrgSettings)
 * ทุกครั้งที่ออกเอกสาร ผู้ใช้แก้ชื่อ/ที่อยู่/โลโก้ได้เองจากหน้าตั้งค่า
 */
export const ISSUER = {
  nameTh: "บริษัท ดู ออล อาคิเทค แอนด์ เอ็นจิเนียริ่ง จำกัด",
  nameEn: "DO ALL ARCHITECT AND ENGINEERING CO.,LTD.",
  address: "สำนักงานใหญ่ : 68/155 หมู่ 3 ถนนชัยพฤกษ์ ตำบลคลองพระอุดม อำเภอปากเกร็ด จังหวัดนนทบุรี 11120",
  taxId: "เลขประจำตัวผู้เสียภาษี 0125563014222",
  /**
   * ⚠️ ใช้ไฟล์โลโก้ที่ "ตัดขอบว่างออกแล้ว" สำหรับหัวกระดาษโดยเฉพาะ — ไม่ใช่ /logo-light-2.png (ภาพจัตุรัส 1024×1024
   * ที่ตัวโลโก้จริงอยู่แค่ช่วงกลาง 40% ของความสูง) ซึ่งทำให้มีพื้นว่างเหนือโลโก้ ~7 มม. และคั่นกลางระหว่างโลโก้กับ
   * ชื่อบริษัทอีก ~11 มม. (ผู้ใช้แจ้ง: "ขยับโลโก้ชิดบนอีก และขยับชื่อและข้อมูลบริษัทขึ้นไปให้พอดี ห่างโลโก้ไม่มาก")
   * ถ้าเปลี่ยนโลโก้บริษัท ต้องตัดขอบภาพใหม่ให้ชิดตัวโลโก้ด้วย ไม่งั้นช่องว่างกลับมาเหมือนเดิม
   */
  logo: "/logo-letterhead.png",
  stamp: "/stamp.png",
};

// ✅ ค่าเลย์เอาต์กระดาษ export ออกไปให้เอกสารชนิดอื่นใช้ร่วมกัน (ดู workNoticePdf.js) — เอกสารของบริษัท
// ต้องมีขอบกระดาษ/ระยะบรรทัด/ตำแหน่งคอลัมน์เท่ากันทุกชนิด ไม่งั้นวางเรียงกันแล้วเห็นได้ทันทีว่าคนละแบบ
export const PAGE = { w: 210, h: 297, left: 22, right: 22 };
export const CONTENT_W = PAGE.w - PAGE.left - PAGE.right;
// ⚠️ ค่าตายตัวเดิม 2 ตัวถูกเลิกใช้แล้วทั้งคู่ (เก็บคอมเมนต์ไว้กันเผลอใส่กลับมา):
//   • LABEL_VALUE_X (คอลัมน์ค่า = ขอบซ้าย+26mm) — ห่างจากป้ายเกินจริงเกือบ 15mm ทุกบรรทัด
//   • INDENT (ระยะเยื้องย่อหน้า 14mm) — คนละแนวกับคอลัมน์ค่า ทำให้ใบหนึ่งมีแนวเริ่มถึง 3 แนว
// ✅ ทั้งคู่ถูกแทนด้วย letterIndentFor ด้านล่าง ซึ่งให้ "แนวเดียว" ที่คำนวณจากความกว้างฟอนต์จริง
// ✅ ระยะบรรทัดก็ไม่ตายตัวแล้วเช่นกัน — ขึ้นกับขนาดตัวอักษรที่เลือกตอนบีบให้จบหน้าเดียว (ดู SCALES)
// TH Sarabun ที่ 14pt ใช้ระยะ 6.6mm เป็นค่าปกติ (ตัวสูงกว่าฟอนต์ละตินขนาดเดียวกันเพราะมีสระบน/
// วรรณยุกต์อีก 2 ชั้นและสระล่างอีก 1 ชั้น — 6mm ทำให้วรรณยุกต์บรรทัดล่างเกือบชนสระล่างของบรรทัดบน)

/**
 * ป้ายหัวจดหมายมาตรฐานของเอกสารบริษัท — เอกสารทุกชนิดใช้ชุดเดียวกัน
 */
export const LETTER_LABELS = ["เลขที่", "วันที่", "เรื่อง", "โครงการ", "เรียน", "อ้างถึง"];

/**
 * ✅ "แนวเยื้อง" เส้นเดียวของทั้งใบ — ใช้เป็นทั้งตำแหน่งคอลัมน์ค่าของหัวจดหมาย, ระยะเยื้องย่อหน้าแรก,
 * จุดเริ่มของรายการ (สิ่งที่ส่งมาด้วย / กำหนดการรายวัน) และบรรทัดคำลงท้าย
 * 🐛 ที่แก้ (บรรทัดเริ่มไม่ตรงกัน ดูไม่เป็นมืออาชีพ): เดิมมีแนวเริ่มถึง 3 แนวในใบเดียว — ขอบซ้าย 22mm,
 * ย่อหน้า 36mm (22+INDENT) และคอลัมน์ค่า 48mm (22+26) ตาแทบไม่มีเส้นนำให้ไล่ตาม
 * ✅ ยุบเหลือ 2 แนว: ขอบซ้าย กับแนวเยื้องเส้นนี้ — ทุกอย่างที่ "ไม่ใช่ป้าย/ไม่ใช่บรรทัดต่อของย่อหน้า"
 * เริ่มตรงกันหมด ⚠️ คิดจากป้ายที่ยาวที่สุดจริงๆ ที่ขนาดฟอนต์ปัจจุบัน (จึงต้องเรียกหลัง setFontSize)
 * ไม่ใช่ค่าตายตัว — เอกสารที่ย่อขนาดตัวอักษรลงจะได้แนวเยื้องที่พอดีกับตัวมันเองเสมอ
 */
export const letterIndentFor = (doc, labels = LETTER_LABELS) =>
  Math.max(...labels.map((l) => doc.getTextWidth(l))) + 6;

/**
 * ✅ เว้นวรรคระหว่างภาษาไทยกับอังกฤษ/ตัวเลขให้อัตโนมัติ
 * 🐛 BUG ที่แก้: ข้อความในเอกสารถูกประกอบจากข้อมูลที่ผู้ใช้กรอกไว้ในระบบ ซึ่งชื่อระบบ/ชื่อโครงการ
 * มักเป็นภาษาอังกฤษ (Fire Alarm, Avenue) พอเอามาต่อท้ายคำไทยตรงๆ จะกลายเป็น "ระบบFire Alarm"
 * ติดกันเป็นพืด อ่านยากและดูไม่เป็นเอกสารทางการเลย (เห็นชัดในใบที่ออกมาจริง)
 * ⚠️ ต้องเว้นทั้ง 2 ทิศทาง (ไทย→ละติน และ ละติน→ไทย) เพราะเจอทั้ง "ระบบFire" และ "Alarmโครงการ"
 * ⚠️ นับ ( ) เป็นขอบเขตด้วย — "จำกัด(มหาชน)" ต้องได้ "จำกัด (มหาชน)"
 * ✅ ใช้กับ "ทุกข้อความ" ก่อนวาดลงกระดาษ ไม่ใช่แก้เฉพาะจุดที่ประกอบข้อความ — ข้อมูลที่ผู้ใช้พิมพ์เอง
 * ในกล่องออกเอกสารก็จะถูกจัดให้เรียบร้อยเหมือนกันหมด ไม่ต้องพึ่งว่าใครจะพิมพ์เว้นวรรคมาถูกไหม
 */
const THAI = "฀-๿";
export const spaceThaiLatin = (s) =>
  String(s ?? "")
    .replace(new RegExp(`([${THAI}])([A-Za-z0-9(])`, "g"), "$1 $2")
    .replace(new RegExp(`([A-Za-z0-9)])([${THAI}])`, "g"), "$1 $2")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

/**
 * ── ชื่อเรียกเอกสารรายงานที่ส่งแนบไปกับใบส่งมอบ ─────────────────────────────
 * ✅ ใบส่งมอบงานถูกส่งไปพร้อม "รายงานหน้างาน" ทุกครั้ง — ชื่อที่เขียนในช่อง "สิ่งที่ส่งมาด้วย" จึงต้อง
 * บอกให้ชัดว่าคือเอกสารอะไร ไม่ใช่แค่ชื่อระบบลอยๆ อย่าง "เอกสาร ระบบ Fire Alarm" ซึ่งลูกค้าอ่านแล้ว
 * ไม่รู้ว่าได้รับอะไรมา
 * ✅ เลือกคำตามลักษณะงานจริงจาก "ประเภทงาน" ที่บันทึกไว้ในระบบ — งานบำรุงรักษาได้คำว่า "ตรวจสอบและ
 * บำรุงรักษา" งานติดตั้งได้ "การติดตั้ง" ฯลฯ ตรงกับสิ่งที่ทำจริงโดยไม่ต้องมาพิมพ์แก้เองทุกใบ
 * ⚠️ ค่าเริ่มต้นกลาง (fallback) ใช้ "รายงานการเข้าปฏิบัติงาน" เพราะเป็นคำที่ถูกต้องกับงานทุกประเภท
 * ไม่ว่าจะเป็นงานแบบไหน — ไม่มีทางเขียนผิดความหมายแม้ประเภทงานจะไม่ตรงกับกฎข้อไหนเลย
 */
const REPORT_NOUN_RULES = [
  { match: /บำรุงรักษา|preventive|\bpm\b/i, noun: "รายงานการตรวจสอบและบำรุงรักษา" },
  { match: /ติดตั้ง|install/i, noun: "รายงานการติดตั้ง" },
  { match: /เปลี่ยน|replace/i, noun: "รายงานการเปลี่ยนอุปกรณ์" },
  { match: /ซ่อม|แก้ไข|repair|corrective|\bcm\b/i, noun: "รายงานการซ่อมแก้ไข" },
  { match: /ตรวจสอบ|สำรวจ|inspect|survey/i, noun: "รายงานการตรวจสอบ" },
  { match: /ทดสอบ|test|commission/i, noun: "รายงานการทดสอบระบบ" },
];
export const DEFAULT_REPORT_NOUN = "รายงานการเข้าปฏิบัติงาน";

/** ✅ รายการให้เลือกในกล่องออกเอกสาร — เผื่อกรณีที่อยากใช้คำอื่นนอกจากที่ระบบเดาให้ */
export const REPORT_NOUN_PRESETS = [
  DEFAULT_REPORT_NOUN,
  ...REPORT_NOUN_RULES.map((r) => r.noun),
  "รายงานผลการปฏิบัติงาน",
  "เอกสารรายงานการบริการ (Service Report)",
];

export const reportNounFor = (title) => {
  const t = String(title || "");
  return REPORT_NOUN_RULES.find((r) => r.match.test(t))?.noun || DEFAULT_REPORT_NOUN;
};

/**
 * ── ตัวเลือกสำเร็จรูปของแต่ละช่อง ───────────────────────────────────────────
 * ✅ ทุกช่องเป็นแบบ "เลือกก็ได้ พิมพ์เองก็ได้" (freeSolo) — รายการพวกนี้ไม่ได้จำกัดสิ่งที่กรอกได้
 * แค่ทำให้กรณีที่เจอบ่อย 90% กดครั้งเดียวจบ ไม่ต้องพิมพ์ยาวๆ ใหม่ทุกใบและไม่ต้องกลัวพิมพ์ผิด
 */

/** "เรียน" — ตำแหน่งผู้รับฝั่งลูกค้าที่เจอจริงในงานอาคาร/โรงงาน */
export const ATTENTION_PRESETS = [
  "ผู้จัดการโครงการ",
  "ผู้จัดการอาคาร",
  "ผู้จัดการฝ่ายวิศวกรรม",
  "หัวหน้าแผนกวิศวกรรม",
  "ผู้จัดการนิติบุคคลอาคารชุด",
  "ผู้จัดการฝ่ายจัดซื้อ",
  "ฝ่ายบริหารอาคาร",
  "ผู้เกี่ยวข้อง",
];

/**
 * "ตำแหน่ง" ของผู้ลงนามฝั่งบริษัทเรา
 * ✅ ครอบคลุมทั้งสายบริหาร (ผู้จัดการ/กรรมการ) และสายหน้างาน (ช่าง/ผู้ควบคุมงาน/ผู้รับผิดชอบโครงการ)
 * เพราะคนที่เซ็นส่งมอบจริงไม่ได้เป็นผู้จัดการเสมอไป — งานเล็กหรืองานที่ส่งมอบหน้างานเลย มักเป็น
 * หัวหน้าช่างหรือผู้รับผิดชอบโครงการเป็นคนเซ็น
 */
/**
 * วางลายเซ็นอิเล็กทรอนิกส์บนเส้นลงชื่อของเอกสาร (ใช้ร่วมกันทั้งใบส่งมอบงานและใบแจ้งเข้างาน)
 *
 * ✅ ผู้ใช้ขอ: ตั้งลายเซ็นไว้ที่ user แล้วนำมาใช้กับเอกสาร PDF ทั้งหมด — ที่นี่คือลายเซ็น "ของผู้ออก
 * เอกสารเอง" ที่ดึงมาจาก /api/signatures/me ตอนกดออกใบ (ดู SignatureService.js)
 * ⚠️ ฐานรูปอยู่เหนือเส้นเล็กน้อยและสูงไม่เกินช่องว่างเหนือเส้น — ไม่งั้นทับคำว่า "ขอแสดงความนับถือ"
 * ⚠️ รูปเสียต้องไม่ทำให้ออกเอกสารไม่ได้ (เอกสารต้องออกได้เสมอ แค่กลับไปเป็นช่องเซ็นมือ)
 * @returns {boolean} วางสำเร็จหรือไม่
 */
export const drawSignatureOnLine = (doc, image, { centerX, lineY, maxW, maxH }) => {
  if (!image) return false;
  try {
    const props = doc.getImageProperties(image);
    const ratio = props.height / props.width || 0.35;
    let w = maxW;
    let h = w * ratio;
    if (h > maxH) { h = maxH; w = h / ratio; }
    doc.addImage(image, "PNG", centerX - w / 2, lineY - h - 0.8, w, h);
    return true;
  } catch {
    return false;
  }
};

export const SIGNER_POSITION_PRESETS = [
  "ผู้จัดการแผนกช่าง",
  "ผู้รับผิดชอบโครงการ",
  "หัวหน้าช่าง",
  "หัวหน้าทีมช่าง",
  "ช่างเทคนิค",
  "ช่างผู้ปฏิบัติงาน",
  "ผู้ควบคุมงาน",
  "ผู้จัดการฝ่ายบริการ",
  "ผู้จัดการโครงการ",
  "วิศวกรโครงการ",
  "วิศวกรผู้ควบคุมงาน",
  "หัวหน้าแผนกวิศวกรรม",
  "ผู้จัดการฝ่ายวิศวกรรม",
  "กรรมการผู้จัดการ",
];

/**
 * "เรื่อง" — ประกอบจากลักษณะงานจริงของใบนั้นๆ ไม่ใช่รายการตายตัว
 * ⚠️ ต้องรับ workLabel เข้ามา ไม่ใช่ export เป็น array คงที่ เพราะหัวเรื่องที่ดีต้องมีชื่องาน/ระบบอยู่ด้วย
 * ("ส่งมอบเอกสาร" เฉยๆ ลูกค้าอ่านแล้วไม่รู้ว่าเอกสารของงานไหน)
 */
// ⚠️ ตัวแรกของรายการ = ค่าเริ่มต้นที่เติมให้ในฟอร์ม (ดู buildDeliveryNoteDefaults) — "ส่งมอบงานและ
// เอกสาร" ครอบคลุมกว่า "ส่งมอบเอกสาร" เฉยๆ เพราะใบนี้ส่งมอบทั้งตัวงานที่ทำเสร็จและเอกสารประกอบ
// ไปพร้อมกัน ไม่ใช่ส่งแค่กระดาษ
// ⚠️ รับ roundLabel มาต่อท้ายด้วย ("ครั้งที่ 1/2") — งานสัญญาเข้าหลายครั้งต่อปี ถ้าหัวเรื่องไม่บอกว่า
// เป็นครั้งไหน เอกสารทุกใบของสัญญาเดียวกันจะมีหัวเรื่องเหมือนกันเป๊ะ แยกไม่ออกตอนเก็บเข้าแฟ้ม
export const subjectPresetsFor = (workLabel, roundLabel) => {
  const w = spaceThaiLatin(workLabel);
  const r = roundLabel ? ` ครั้งที่ ${roundLabel}` : "";
  if (!w) return [`ส่งมอบงานและเอกสารที่เกี่ยวข้อง${r}`, `ส่งมอบเอกสารงานบริการ${r}`];
  return [
    `ส่งมอบงานและเอกสาร ${w}${r}`,
    `ส่งมอบเอกสาร ${w}${r}`,
    `ส่งมอบรายงานผลการปฏิบัติงาน ${w}${r}`,
    `ขอส่งมอบเอกสารประกอบการตรวจรับงาน ${w}${r}`,
    `ส่งมอบเอกสารเพื่อประกอบการวางบิล ${w}${r}`,
  ].map(spaceThaiLatin);
};

/**
 * "อ้างถึง" — สร้างตัวเลือกจากเลขเอกสารที่ผูกกับงานนี้อยู่แล้วในระบบ
 * ✅ ตอบโจทย์ "เลือกได้ว่าจะอ้างอิงเอกสารอะไร ตามข้อมูลงานที่มีอยู่แล้ว" — ไม่ต้องเปิดหน้าอื่นไปคัดลอก
 * เลขมาวาง และไม่มีทางพิมพ์เลขผิด เพราะเลือกจากค่าที่บันทึกไว้จริง
 * ⚠️ เรียงตามลำดับที่ใช้อ้างอิงกันจริงในงานส่งมอบ: ใบเสนอราคา (ตัวที่ลูกค้าอนุมัติให้ทำงาน) มาก่อน
 * แล้วค่อยเลขที่สัญญา แล้วค่อยเลขเอกสารภายใน
 */
/**
 * ── อ่านข้อมูลงานให้ได้ครบไม่ว่าจะถูกเรียกมาจากหน้าไหน ─────────────────────────
 * 🐛 BUG ที่แก้ (ประเภทงานไม่ถูกดึงมาให้ เช่น PM / Service หายไปจากเอกสาร):
 * กล่องออกเอกสารถูกเปิดได้จาก 3 ที่ ซึ่งส่ง "ตัวงาน" มาคนละรูปแบบกัน
 *   • หน้าการดำเนินงาน / หน้าภาพรวมงาน → object ดิบจาก API ฟิลด์อยู่ระดับบนสุดทั้งหมด
 *   • หน้า Event (ปฏิทิน) → FullCalendar Event object ซึ่งย้ายฟิลด์ที่ไม่รู้จักเข้า .extendedProps
 *     ให้อัตโนมัติ "แต่ไม่ย้ายทุกตัว" — title / start / end / allDay ยังอยู่ระดับบนสุดเสมอ เพราะ
 *     FullCalendar รู้จักฟิลด์พวกนี้เองและทำเป็น getter บน prototype ไว้
 * เดิมโค้ดอ่านจาก `job.extendedProps || job` อย่างเดียว = พอเป็น event จากปฏิทินก็ได้แต่ extendedProps
 * ซึ่งไม่มี title/start/end เลย → "ประเภทงาน" หายทุกใบ และวันที่เสร็จงานก็ตกไปใช้วันนี้แทนวันจริง
 * ✅ อ่าน extendedProps ก่อน แล้ว fallback ไปอ่าน property ระดับบนสุด (ผ่าน job[k] ตรงๆ ซึ่งเรียก
 * getter ของ FullCalendar ได้ถูกต้อง — ใช้ spread `{...job}` ไม่ได้ เพราะ getter อยู่บน prototype
 * ไม่ใช่ own property จึงถูก spread ข้ามไปหมด)
 */
export const resolveJobFields = (job) => {
  const ext = job?.extendedProps || {};
  const get = (k) => {
    const v = ext[k];
    if (v !== undefined && v !== null && v !== "") return v;
    return job?.[k];
  };
  return {
    title: get("title"), system: get("system"), site: get("site"), company: get("company"),
    quotationNo: get("quotationNo"), contractNo: get("contractNo"), docNo: get("docNo"),
    time: get("time"), visitCount: get("visitCount"), responsiblePerson: get("responsiblePerson"),
    start: get("start"), end: get("end"), date: get("date"), allDay: get("allDay"),
    // ✅ ข้อมูลสัญญาสำหรับป้ายครั้งที่รายปี "1/4 - 2569-70" (ดู formatRoundLabel)
    contractStart: get("contractStart"), contractEnd: get("contractEnd"), contractYears: get("contractYears"), intervalMonths: get("intervalMonths"),
    // ✅ (17 ต.ค. 2569 "ให้สอดคล้องกับระบบปัจจุบัน") ข้อมูลจากขั้นรับงาน — เลข Job · เอกสารที่ได้รับ (PO/ใบเสนอราคา) · ผู้ติดต่อหน้างาน
    jobNo: get("jobNo"), intakeDocType: get("intakeDocType"), intakeDocNo: get("intakeDocNo"),
    contactName: get("contactName"), contactTel: get("contactTel"),
  };
};

export const referencePresetsFor = (job) => {
  const p = resolveJobFields(job);
  // ✅ เอกสารที่ได้รับตอนรับงาน (หน้างานใหม่) — PO ของลูกค้าคือเอกสารที่ลูกค้าใช้ตรวจรับ/วางบิลจริง จึงขึ้นก่อน
  const intakeRef = p.intakeDocNo
    ? (p.intakeDocType === "po" ? `ใบสั่งซื้อ (PO) เลขที่ ${p.intakeDocNo}`
      : p.intakeDocType === "quotation" ? `ใบเสนอราคาเลขที่ ${p.intakeDocNo}` : `เอกสารเลขที่ ${p.intakeDocNo}`)
    : "";
  return [...new Set([
    intakeRef,
    p.quotationNo && `ใบเสนอราคาเลขที่ ${p.quotationNo}`,
    p.contractNo && `สัญญาเลขที่ ${p.contractNo}`,
    p.docNo && `เอกสารเลขที่ ${p.docNo}`,
    p.contractNo && p.time && `สัญญาเลขที่ ${p.contractNo} ครั้งที่ ${formatRoundLabel(p.time, p.visitCount, p)}`,
    p.jobNo && `เลขที่งาน ${p.jobNo}`,
  ].filter(Boolean).map(spaceThaiLatin))];
};

/** ค่าตั้งต้นของ "อ้างถึง" — เอกสารที่ลูกค้ารู้จัก (PO/ใบเสนอราคา/สัญญา) · เลขที่งานภายในเป็นแค่ตัวเลือก ไม่ใช้เป็นค่าตั้งต้น */
export const defaultReferenceFor = (job) => referencePresetsFor(job).find((r) => !r.startsWith("เลขที่งาน")) || "";

/** ✅ (17 ต.ค. 2569) "เรียน" — ผู้ติดต่อหน้างานของงานนี้ขึ้นเป็นตัวเลือกแรก (ถ้ามี) ตามด้วยตำแหน่งที่ใช้บ่อย */
export const attentionPresetsFor = (job) => {
  const name = String(resolveJobFields(job).contactName || "").trim();
  const contact = name ? (/^(คุณ|นาย|นาง|น\.ส\.|ดร\.)/.test(name) ? name : `คุณ${name}`) : "";
  return [...new Set([contact, ...ATTENTION_PRESETS].filter(Boolean))];
};

/** วันที่แบบไทยเต็ม เช่น "7 สิงหาคม 2569" */
// ⚠️ เดิมคำนวณ พ.ศ. เองตรงนี้ (m.year() + 543) — ย้ายไปใช้ตัวกลางที่ shared/utils/thaiDate แล้ว
// เพื่อให้ "วันที่ในเอกสาร PDF" กับ "วันที่บนหน้าจอ" มาจากตรรกะเดียวกันเสมอ ไม่มีทางเพี้ยนคนละแบบ
export const thaiFullDate = (d) => thaiDateFull(d);

/**
 * ตัดบรรทัดย่อหน้า โดยให้บรรทัดแรกแคบลงเท่าระยะเยื้อง
 * ⚠️ ทำไมไม่ใช้ doc.splitTextToSize ตรงๆ: มันรับความกว้างได้ค่าเดียว ใช้กับย่อหน้าที่บรรทัดแรก
 * เยื้องเข้ามาไม่ได้ (ถ้าส่งความกว้างที่หักระยะเยื้องแล้ว บรรทัดที่ 2 เป็นต้นไปจะสั้นกุดตามไปด้วยทั้ง
 * ย่อหน้า ขอบขวาแหว่งเป็นฟันปลา) — จึงตัดเองทีละคำ โดยเทียบความกว้างจริงจาก doc.getTextWidth
 * ⚠️ ภาษาไทยไม่มีเว้นวรรคระหว่างคำ ก้อนคำไทยยาวๆ ก้อนเดียวจึงอาจกว้างเกินบรรทัดได้ — กรณีนั้น
 * fallback ไปใช้ splitTextToSize หั่นก้อนนั้นต่อ (ยอมให้ตัดกลางคำ ดีกว่าปล่อยให้ล้นออกนอกกระดาษ)
 */
/**
 * 🔁 (17 ต.ค. 2569 ผู้ใช้: "การตัดบรรทัดต่างๆ ที่ไม่สวย ไม่มืออาชีพ แก้ไขให้สมบูรณ์")
 *    เดิมตัดบรรทัดได้เฉพาะ "ช่องว่าง" — ภาษาไทยเขียนติดกันเป็นก้อนยาว บรรทัดจึงขาดสั้นกุดกลางหน้า (ขอบขวาแหว่ง)
 *    หรือหั่นกลางคำ ✅ ตัดตาม "ขอบเขตคำไทย" ด้วย Intl.Segmenter (มีในเบราว์เซอร์ทุกตัวที่ใช้แอปนี้)
 *    บรรทัดเต็มความกว้างสม่ำเสมอ และไม่ตัดกลางคำ · ไม่มี Segmenter = ตัดที่ช่องว่างแบบเดิม
 * ⚠️ เครื่องหมายที่ห้ามขึ้นต้นบรรทัด (ฯ ๆ . , ) : ;) ติดไปกับคำก่อนหน้าเสมอ
 */
const SEGMENTER = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter("th", { granularity: "word" }) : null;
const NO_LINE_START = /^[ฯๆ.,):;!?%\]]+$/;
// ✅ คำนำหน้าที่ตัวตัดคำแยกออกจากคำหลัก (ผู้|ใช้ · การ|ทำงาน · ความ|ปลอดภัย) — ห้ามจบบรรทัดด้วยคำพวกนี้ ติดไปกับคำถัดไปเสมอ
const GLUE_NEXT = new Set(["ผู้", "การ", "ความ", "นัก", "ช่าง", "ผู้ใช้", "ใน", "ณ", "(", "ต่อ", "เพื่อ", "ตาม"]);
// ✅ คำประสมที่ตัวตัดคำแยกเป็น 2 ชิ้น (ดำเนิน|การ) แล้วไปตกคนละบรรทัด — รวมกลับก่อนตัดบรรทัด
const COMPOUNDS = new Set([
  "ดำเนินการ", "ประสานงาน", "ปฏิบัติงาน", "บำรุงรักษา", "ส่วนกลาง", "นัดหมาย", "ร่วมมือ", "ปลอดภัย", "ห้องพัก",
  "ผู้ใช้", "เรียบร้อย", "ตรวจสอบ", "ตรวจเช็ค", "รับมอบ", "ส่งมอบ", "ติดต่อ", "กลับมา", "อุปกรณ์", "เจ้าหน้าที่", "พิจารณา",
]);
const breakTokens = (text) => {
  const raw = SEGMENTER ? [...SEGMENTER.segment(text)].map((x) => x.segment) : text.split(/(\s+)/);
  const out = [];
  let glue = false;
  raw.forEach((t) => {
    if (!t) return;
    const prev = out[out.length - 1];
    if (out.length && (glue || NO_LINE_START.test(t) || COMPOUNDS.has(prev + t) || /[/]$/.test(prev) || t === "/") && !/^\s+$/.test(t)) out[out.length - 1] += t;
    else out.push(t);
    glue = GLUE_NEXT.has(t);
  });
  // ✅ รอบสอง: ไม่ตัดกลาง "25 - 50" / "1/2 - 2569" และชื่อเฉพาะภาษาอังกฤษหลายคำ ("Fire Alarm", "Amazon Residence")
  const isSpace = (t) => /^\s+$/.test(t);
  const isLatinCap = (t) => /^[A-Z][A-Za-z0-9.&'-]*$/.test(t);
  const merged = [];
  for (let k = 0; k < out.length; k += 1) {
    const t = out[k];
    const last = merged[merged.length - 1];
    const prevTok = merged.length >= 2 && isSpace(last) ? merged[merged.length - 2] : null;
    // "... -" + " " + "50"  หรือ  "25" + " " + "- ..."
    if (isSpace(t) && last && /[-–]$/.test(last.trim()) && out[k + 1] && !isSpace(out[k + 1])) { merged[merged.length - 1] += t + out[k + 1]; k += 1; continue; }
    if (/^[-–]/.test(t) && prevTok) { merged.splice(merged.length - 2, 2, prevTok + last + t); continue; }
    // "1 ท่าน" / "2 ชุด" — ตัวเลขกับหน่วยไม่แยกบรรทัด
    if (prevTok && /^\d+$/.test(prevTok) && /^[฀-๿]/.test(t) && t.length <= 6) { merged.splice(merged.length - 2, 2, prevTok + last + t); continue; }
    if (isLatinCap(t) && prevTok && /[A-Za-z]$/.test(prevTok) && (prevTok + last + t).length <= 28) { merged.splice(merged.length - 2, 2, prevTok + last + t); continue; }
    merged.push(t);
  }
  return merged;
};

/**
 * ✅ (17 ต.ค. 2569 ผู้ใช้: "ตัวหนังสือที่มันเลยแบบนี้ ไม่สวย ไม่มืออาชีพ") — จัดย่อหน้าแบบ "กระจายแบบไทย" (Thai distributed)
 *    เหมือนหนังสือราชการ/Word: ทุกบรรทัดยกเว้นบรรทัดสุดท้ายชิดขอบซ้าย-ขวาเท่ากัน โดยเกลี่ยช่องไฟระหว่างคำ
 *    (ไม่ยืดระยะตัวอักษร — วรรณยุกต์/สระบนล่างจะเพี้ยน) · ช่องไฟเกินควร (บรรทัดมีคำน้อยมาก) = ชิดซ้ายธรรมดา
 */
export const drawJustified = (doc, line, x, y, width) => {
  // ⚠️ ช่องว่างเดิม (ระหว่างคำอังกฤษ/หลังเครื่องหมาย) คงความกว้างปกติไว้แล้วบวกช่องไฟเพิ่ม — ไม่ตัดทิ้ง ไม่งั้น "Fire Alarm" จะชิดกัน
  const toks = breakTokens(String(line).trim());
  const textW = toks.reduce((n, t) => n + doc.getTextWidth(t), 0);
  const gaps = toks.length - 1;
  const extra = gaps > 0 ? (width - textW) / gaps : 0;
  if (gaps <= 0 || extra < 0 || extra > 6) { doc.text(line, x, y); return; }
  let cx = x;
  toks.forEach((t) => { doc.text(t, cx, y); cx += doc.getTextWidth(t) + extra; });
};
export const wrapParagraph = (doc, text, firstWidth, restWidth) => {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const isSp = (t) => /^\s+$/.test(t);
  const lines = []; // แต่ละบรรทัดเก็บเป็นชิ้นคำ (รวมช่องว่าง) — ใช้ย้ายคำระหว่างบรรทัดได้โดยไม่เสียช่องว่างเดิม
  let cur = [];
  const spaceBefore = []; // บรรทัดนั้นเริ่มหลังช่องว่างเดิมหรือไม่ (ตัดตรงช่องว่าง)
  const str = (toks) => toks.join("").trim();
  const limitFor = () => (lines.length === 0 ? firstWidth : restWidth);
  const fits = (toks) => doc.getTextWidth(str(toks)) <= limitFor();
  for (const tok of breakTokens(clean)) {
    if (fits([...cur, tok])) { cur.push(tok); continue; }
    if (str(cur)) { lines.push(cur); cur = []; spaceBefore[lines.length] = isSp(tok); }
    if (isSp(tok)) continue;
    if (fits([tok])) { cur = [tok]; continue; }
    // ก้อนเดียวยาวเกินบรรทัด (เช่น เลขเอกสาร/URL ยาวมาก) → หั่นก้อนนั้นเอง ดีกว่าล้นออกนอกกระดาษ
    const chunks = doc.splitTextToSize(tok, limitFor());
    for (let i = 0; i < chunks.length - 1; i += 1) lines.push([chunks[i]]);
    cur = [chunks[chunks.length - 1]];
  }
  if (str(cur)) lines.push(cur);
  // ✅ กันบรรทัดสุดท้ายเหลือคำเดียวโดดๆ (เช่น "1 ท่าน") — ดึงคำท้ายของบรรทัดก่อนลงมาอยู่ด้วย ถ้ายังพอดีบรรทัด
  const n = lines.length;
  if (n >= 2 && doc.getTextWidth(str(lines[n - 1])) < restWidth * 0.2) {
    const prev = lines[n - 2];
    let k = prev.length - 1;
    while (k > 0 && isSp(prev[k])) k -= 1;
    const words = prev.filter((t) => !isSp(t)).length;
    const moved = prev.slice(k);
    const next = [...moved, spaceBefore[n - 1] ? " " : "", ...lines[n - 1]];
    if (words > 3 && doc.getTextWidth(str(next)) <= restWidth) {
      lines[n - 2] = prev.slice(0, k);
      lines[n - 1] = next;
    }
  }
  return lines.map(str);
};

/** ตัดบรรทัดข้อความทั่วไป (ความกว้างเท่ากันทุกบรรทัด) — ใช้แทน doc.splitTextToSize กับข้อความไทยทุกจุด */
export const wrapText = (doc, text, width) =>
  String(text ?? "").split("\n").flatMap((ln) => (ln.trim() ? wrapParagraph(doc, ln, width, width) : []));

/**
 * ✅ ประกอบ "ค่าเริ่มต้น" ของเอกสารจากตัวงาน — ให้ผู้ใช้กดออกใบได้เลยโดยแทบไม่ต้องพิมพ์อะไร
 * (ตามที่ขอว่า "ออกได้ง่าย ตามลักษณะงาน") แต่ทุกช่องยังแก้ไขได้ก่อนออกจริงในกล่องยืนยัน
 *
 * @param {object} job  — event/แถวงาน (รองรับทั้ง object ดิบจาก API และ FullCalendar extendedProps)
 * @param {object} customer — ข้อมูลลูกค้าจากตาราง Customer (เอาที่อยู่มาใส่) อาจเป็น null ได้
 */
export const buildDeliveryNoteDefaults = (job, customer) => {
  // ⚠️ ต้องอ่านผ่าน resolveJobFields เสมอ — ดูเหตุผลที่นิยามของมัน (ประเภทงาน/วันที่ของ event จาก
  // ปฏิทินไม่ได้อยู่ใน extendedProps)
  const p = resolveJobFields(job);
  const site = p.site || "";
  const company = p.company || customer?.cCompany || "";
  const system = p.system || "";
  const title = p.title || "";

  // ✅ "เรื่อง" ประกอบจากลักษณะงานจริง — งานบำรุงรักษาระบบแจ้งเหตุเพลิงไหม้ ก็ได้เรื่องที่ตรงกับงานนั้น
  // ทันทีโดยไม่ต้องพิมพ์เอง (เทียบกับตัวอย่าง: "ส่งมอบเอกสารการบำรุงรักษาระบบสัญญาณแจ้งเหตุเพลิงไหม้")
  // ⚠️ ผ่าน spaceThaiLatin ทุกจุดที่ต่อคำไทยกับข้อมูลที่ผู้ใช้กรอก — ชื่อระบบ/ประเภทงานมักเป็นภาษา
  // อังกฤษ ("Fire Alarm") ถ้าต่อตรงๆ จะได้ "ระบบFire Alarm" ติดกันเป็นพืด (ดูคอมเมนต์ที่ spaceThaiLatin)
  // ✅ workLabel = "ประเภทงาน + ระบบ" เช่น "PM ระบบ Fire Alarm" — เป็นตัวตั้งของทั้งหัวเรื่องและ
  // เนื้อความ ทำให้เอกสารบอกได้ว่าเข้าไปทำ "งานอะไร กับระบบไหน" ไม่ใช่แค่ "ส่งมอบเอกสาร" ลอยๆ
  const workLabel = spaceThaiLatin([title, system && `ระบบ ${system}`].filter(Boolean).join(" "));
  // ✅ "ครั้งที่ 1/2" — งานสัญญาเข้าหลายครั้งต่อปี ลูกค้าต้องรู้ว่าใบนี้ส่งมอบของครั้งไหน ไม่งั้นพอเก็บ
  // เอกสารหลายใบไว้ด้วยกันจะแยกไม่ออกว่าใบไหนของรอบไหน (โดยเฉพาะเวลาตรวจรับ/วางบิลย้อนหลัง)
  // ⚠️ ใช้ formatRoundLabel ตัวเดียวกับที่ทั้งแอปใช้ (ใบแจ้งเข้างาน/ตารางภาพรวมงาน) กันรูปแบบเลข
  // ครั้งที่ไม่ตรงกันในเอกสารคนละใบของงานเดียวกัน — งานที่ไม่มีครั้งที่ (งานทั่วไป) จะได้ค่าว่าง
  const roundLabel = formatRoundLabel(p.time, p.visitCount, p);
  // ⚠️ เอาค่าแรกจาก subjectPresetsFor เสมอ ไม่ประกอบข้อความเองซ้ำอีกที่ — ไม่งั้นเปลี่ยนค่าเริ่มต้น
  // ทีต้องไล่แก้ 2 จุดแล้วลืมจุดใดจุดหนึ่ง
  const subject = subjectPresetsFor(workLabel, roundLabel)[0];
  // ชื่อเรียกเอกสารรายงานที่ส่งแนบไปด้วย — เลือกคำตามลักษณะงาน (ดู reportNounFor)
  const reportNoun = reportNounFor(title);

  // ✅ วันที่เสร็จงาน — ใช้วันสิ้นสุดของงาน (allDay ของ FullCalendar เก็บ end แบบ exclusive คือ
  // บวกไปแล้ว 1 วัน ต้องลบกลับก่อนเสมอ ไม่งั้นเอกสารจะขึ้นวันเสร็จเกินจริงไป 1 วันทุกใบ)
  // ⚠️ "allDay !== false" ไม่ใช่ "allDay === true" — ฟิลด์นี้ตั้ง default:true ไว้ที่ฐานข้อมูล
  // (models/Events.js) งานเก่าบางรายการจึงไม่มีค่านี้ติดมาเลย ถ้าเช็คแบบ === true จะตกไปทางงานมีเวลา
  // แล้วไม่ลบ 1 วัน = วันที่เสร็จงานในเอกสารเกินจริงไป 1 วันเงียบๆ โดยไม่มีอะไรฟ้อง
  const rawEnd = p.end || p.start || p.date;
  const completedAt = rawEnd
    ? (p.allDay !== false ? moment(rawEnd).subtract(1, "days") : moment(rawEnd))
    : moment();

  return {
    docNumber: "",                       // เติมจาก API ตอนเปิดกล่อง (ดู routes/docNumber.js)
    issuedAt: moment().format("YYYY-MM-DD"),
    subject,
    site,
    customerCompany: company,
    customerAddress: customer?.address || "",
    // ✅ เลขประจำตัวผู้เสียภาษีของลูกค้า — เอกสารที่ใช้ประกอบการวางบิล/ตรวจรับงานมักต้องมีเลขนี้กำกับ
    // ดึงจากทะเบียนลูกค้าที่มีอยู่แล้วในระบบ (Customer.tax) ไม่ต้องไปเปิดหาจากที่อื่นมาพิมพ์เอง
    customerTaxId: customer?.tax || "",
    attention: ATTENTION_PRESETS[0],
    // เลือกอ้างอิงตัวแรกที่มีจริง (ใบเสนอราคา → สัญญา → เอกสารภายใน) เปลี่ยนเป็นตัวอื่นได้ในกล่อง
    reference: defaultReferenceFor(job),
    // ✅ "สิ่งที่ส่งมาด้วย" = ชื่อรายงานตามลักษณะงาน + ระบบที่เข้าทำ (ดู reportNounFor)
    // เช่น "รายงานการตรวจสอบและบำรุงรักษา ระบบ Fire Alarm จำนวน 1 ชุด"
    attachments: [
      {
        text: spaceThaiLatin([
          reportNoun,
          system && `ระบบ ${system}`,
          roundLabel && `ครั้งที่ ${roundLabel}`,
        ].filter(Boolean).join(" ")),
        qty: "1 ชุด",
      },
    ],
    reportNoun,
    completedAt: completedAt.format("YYYY-MM-DD"),
    workLabel,
    roundLabel,
    signerName: p.responsiblePerson || "",
    signerPosition: SIGNER_POSITION_PRESETS[0],
  };
};

/**
 * ✅ เนื้อความหลัก — ประกอบจากค่าที่กรอก ให้แก้ได้ทีหลังในกล่องยืนยันถ้าต้องการปรับถ้อยคำ
 * 🐛 BUG ที่แก้ (ประโยคอ่านไม่รู้เรื่อง): เดิมต่อชื่อโครงการต่อท้ายชื่องานเฉยๆ ได้ประโยคว่า
 * "การดำเนินการระบบFire Alarm Avenue" ซึ่งอ่านแล้วไม่รู้ว่า Avenue คืออะไร (เป็นชื่อโครงการ) —
 * ต้องมีคำว่า "โครงการ" นำหน้าเสมอ และเว้นวรรคคั่นภาษาให้ถูก
 */
export const buildDeliveryNoteBody = (f) => {
  const work = f.workLabel || "งานบริการ";
  const place = f.site ? ` โครงการ ${f.site}` : "";
  const round = f.roundLabel ? ` ครั้งที่ ${f.roundLabel}` : "";
  // 🔁 (17 ต.ค. 2569 ผู้ใช้: "ใช้คำง่ายๆ ไม่กำกวม") — ประโยคเดียวจบความ: ทำอะไร · ที่ไหน · ตามเอกสารไหน · เสร็จเมื่อไร · ส่งอะไรมา · ขออะไร
  //    (เดิมซ้ำชื่องาน/โครงการ 2 รอบในย่อหน้าเดียว และ "อ้างอิง ใบ..." อ่านสะดุด)
  const ref = f.reference ? ` ตาม${f.reference}` : "";
  // ⚠️ อ้างชื่อรายงานด้วยข้อความจริงในช่อง "สิ่งที่ส่งมาด้วย" — เอกสารฉบับเดียวกันต้องเรียกชื่อเดียวกันทั้งใบ
  const reportNoun =
    (f.attachments || []).find((a) => (a.text || "").trim())?.text?.trim()
    || f.reportNoun
    || DEFAULT_REPORT_NOUN;
  return spaceThaiLatin(
    `ตามที่ ${ISSUER.nameTh} ได้ดำเนินการ ${work}${place}${round}${ref} ` +
    `แล้วเสร็จเมื่อวันที่ ${thaiFullDate(f.completedAt)} นั้น บริษัทฯ ขอส่งมอบงานพร้อม${reportNoun} ` +
    `ตามรายการที่ส่งมาด้วย เพื่อโปรดตรวจสอบและลงนามรับมอบงาน`
  );
};

/**
 * ✅ เปิดเอกสาร jsPDF พร้อมฟอนต์ไทย — แยกออกมาเพราะเอกสารทุกชนิดต้องทำ 4 บรรทัดนี้เหมือนกันเป๊ะ และถ้า
 * ลืมโหลดฟอนต์ TH Sarabun ภาษาไทยทั้งใบจะกลายเป็นสี่เหลี่ยมทันที (พลาดง่ายมากตอนเพิ่มเอกสารชนิดใหม่)
 */
/**
 * ── ขนาดไฟล์ PDF ─────────────────────────────────────────────────────────────
 * 🐛 ผู้ใช้แจ้ง: "ขนาดไฟล์มันใหญ่มาก แปลกๆ" — ใบส่งมอบงานใบเดียวเคยหนักเกือบ 5 MB
 * สาเหตุ: โลโก้หัวกระดาษ (166 KB) กับตราประทับ (226 KB) เป็น PNG ขนาดเต็มความละเอียดต้นฉบับ
 * ถูกฝังลงไฟล์แบบไม่ย่อและไม่บีบอัด ทั้งที่พิมพ์ออกมาจริงกว้างแค่ 28 มม. และ 24 มม.
 * ✅ ย่อรูปให้พอดีความละเอียดงานพิมพ์ (≈300 dpi) หนึ่งครั้งแล้วแคชไว้ + เปิด compress ของ jsPDF
 * ⚠️ ต้องคง "ความโปร่งใส" ไว้ (โลโก้/ตราประทับวางทับข้อความ) จึงย่อเป็น PNG ไม่ใช่ JPEG
 */
/**
 * ความละเอียดสูงสุดของรูปประจำเอกสาร (px) — คำนวณจากค่าปัจจุบันทุกครั้ง
 * ⚠️ ห้ามคำนวณครั้งเดียวตอนโหลดโมดูล — โลโก้เปลี่ยนได้จากหน้าตั้งค่าองค์กร ถ้าล็อกพาธไว้ตั้งแต่ต้น
 * รูปใหม่จะไม่เคยถูกย่อ/แคช และหัวกระดาษจะยังเป็นโลโก้เก่าจนกว่าจะรีโหลดหน้า
 */
const printAssetSizes = () => ({ [ISSUER.logo]: 420, [ISSUER.stamp]: 360 });
const printAssetCache = new Map();

const downscalePng = (url, maxPx) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    // 🔁 (17 ต.ค. 2569 ผู้ใช้: "ตราประทับดูเล็กเกินไป") — ไฟล์ตรามีขอบใสรอบตัวตราเกือบครึ่งภาพ (ตราจริงกินแค่ ~60%)
    //    กำหนดขนาด 40 มม. แต่ตาเห็นแค่ ~22 มม. ✅ ตัดขอบใสออกก่อน ขนาดที่กำหนด = ขนาดตราที่เห็นจริง
    let sx = 0; let sy = 0; let sw = img.naturalWidth; let sh = img.naturalHeight;
    try {
      const probe = document.createElement("canvas");
      probe.width = sw; probe.height = sh;
      const pctx = probe.getContext("2d");
      pctx.drawImage(img, 0, 0);
      const { data } = pctx.getImageData(0, 0, sw, sh);
      let x0 = sw; let y0 = sh; let x1 = -1; let y1 = -1;
      for (let yy = 0; yy < sh; yy += 2) {
        for (let xx = 0; xx < sw; xx += 2) {
          if (data[(yy * sw + xx) * 4 + 3] > 16) {
            if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy;
          }
        }
      }
      if (x1 > x0 && y1 > y0) {
        const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.02);
        sx = Math.max(0, x0 - pad); sy = Math.max(0, y0 - pad);
        sw = Math.min(img.naturalWidth, x1 + pad + 1) - sx; sh = Math.min(img.naturalHeight, y1 + pad + 1) - sy;
      }
    } catch { /* อ่านพิกเซลไม่ได้ (CORS) — ใช้ทั้งภาพตามเดิม */ }
    const scale = Math.min(1, maxPx / sw);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    try { resolve(canvas.toDataURL("image/png")); } catch { resolve(url); }
  };
  img.onerror = () => reject(new Error(`โหลดรูปไม่สำเร็จ: ${url}`));
  img.src = url;
});

/**
 * เตรียมรูปประจำเอกสาร (โลโก้/ตราประทับ) แบบย่อแล้ว — เรียกก่อนเริ่มวาดทุกครั้ง
 * ⚠️ ล้มเหลวต้องไม่ทำให้ออกเอกสารไม่ได้ — ตกกลับไปใช้ไฟล์ต้นฉบับเหมือนเดิม (แค่ไฟล์ใหญ่ขึ้น)
 */
/**
 * ดึงค่าตั้งค่าองค์กรมาทับ ISSUER — ✅ ผู้ใช้ขอให้เปลี่ยนโลโก้/ข้อมูลบริษัทเองได้จากหน้าตั้งค่า
 * ⚠️ ต้อง "เขียนทับในอ็อบเจกต์เดิม" ไม่ใช่สร้างก้อนใหม่ — เอกสารทุกชนิด import ISSUER ตัวนี้ไปแล้ว
 * ⚠️ ค่าที่ยังไม่ได้ตั้ง (ว่าง) ตกกลับไปใช้ของที่ติดมากับแอป (ดู ORG_FALLBACK)
 */
export const applyOrgSettings = (s) => {
  if (!s) return;
  ISSUER.nameTh = s.nameTh || ISSUER.nameTh;
  ISSUER.nameEn = s.nameEn || ISSUER.nameEn;
  ISSUER.address = s.address || ISSUER.address;
  ISSUER.taxId = s.taxId || ISSUER.taxId;
  ISSUER.logo = s.letterheadUrl || ISSUER.logo;
  ISSUER.stamp = s.stampUrl || ISSUER.stamp;
};

export const preparePrintAssets = async () => {
  // ✅ จุดเดียวที่เอกสารทุกชนิดเรียกก่อนวาดเสมอ — เอาค่าองค์กรล่าสุดมาใช้ตรงนี้ที่เดียว
  try {
    applyOrgSettings(await OrgSettingService.load());
  } catch {
    /* ใช้ค่าที่ติดมากับแอปต่อไป — ออกเอกสารไม่ได้เพราะโหลดตั้งค่าไม่ได้ถือว่าแย่กว่า */
  }
  await Promise.all(Object.entries(printAssetSizes()).map(async ([url, maxPx]) => {
    if (printAssetCache.has(url)) return;
    try {
      printAssetCache.set(url, await downscalePng(url, maxPx));
    } catch {
      printAssetCache.set(url, url);
    }
  }));
};

/** รูปที่ย่อแล้ว (ถ้าเตรียมไว้) — ใช้แทน URL ต้นฉบับตอน addImage */
export const printAsset = (url) => printAssetCache.get(url) || url;

export const createDocument = (jsPDF, thSarabunFont) => {
  // ⚠️ compress: true บีบทั้งฟอนต์ที่ฝังและเนื้อหา — ฟอนต์ TH Sarabun ตัวเดียวหนัก ~470 KB
  // ถ้าไม่บีบ ไฟล์จะใหญ่กว่าที่ควรเป็นหลายเท่าโดยที่หน้าตาเอกสารเหมือนกันทุกประการ
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "A4", compress: true });
  doc.addFileToVFS("THSarabun.ttf", thSarabunFont);
  doc.addFont("THSarabun.ttf", "THSarabun", "normal");
  doc.addFileToVFS("THSarabunBold.ttf", thSarabunBold);
  doc.addFont("THSarabunBold.ttf", "THSarabun", "bold");
  doc.setFont("THSarabun", "normal");
  return doc;
};

/**
 * ✅ หัวกระดาษ (โลโก้ + ชื่อบริษัท ไทย/อังกฤษ + ที่อยู่ + เลขผู้เสียภาษี) — ใช้ร่วมกันทุกชนิดเอกสาร
 * ย้ายที่อยู่/เบอร์ทีเดียวแล้วเปลี่ยนครบทุกใบ ไม่ต้องไล่แก้ทีละไฟล์แล้วลืมไปใบหนึ่ง
 * @returns {number} พิกัด y หลังวาดหัวกระดาษเสร็จ (ตัวเรียกเอาไปวางเนื้อหาต่อ)
 */
export const drawLetterhead = (doc) => {
  const centerX = PAGE.w / 2;
  // ✅ โลโก้ชิดขอบบน 8 มม. (ขอบพิมพ์ไม่ติดของเครื่องพิมพ์ทั่วไปอยู่ราว 4–6 มม.) กว้าง 28 มม. ≈ ขนาดตัวโลโก้เท่าเดิม
  let y = 8;
  try {
    const logo = printAsset(ISSUER.logo);
    const props = doc.getImageProperties(logo);
    const w = 28;
    const h = (props.height / props.width) * w;
    // alias = ฝังรูปเดียวกันซ้ำในไฟล์เดียวไม่ได้ทำให้ไฟล์ใหญ่ขึ้นอีกรอบ
    doc.addImage(logo, "PNG", centerX - w / 2, y, w, h, "letterhead-logo", "MEDIUM");
    y += h + 2.2;
  } catch {
    // ⚠️ ไม่มีโลโก้ก็ยังต้องออกเอกสารได้ — เว้นที่ไว้เท่าความสูงโลโก้จริงเพื่อไม่ให้เลย์เอาต์ที่เหลือขยับ
    y += 14.5;
  }

  // ✅ ไล่ขนาดตัวอักษรลงตามลำดับความสำคัญ (17 → 11.5 → 10.5) และเว้นระยะแต่ละบรรทัดให้ต่างกันตาม
  // ขนาดจริงของแต่ละบรรทัด แทนการบวกทีละ 6 คงที่แบบเดิมซึ่งทำให้ชื่อบริษัทตัวใหญ่ดูอึดอัดติดบรรทัดล่าง
  doc.setFontSize(17);
  y += 5.6;
  doc.text(ISSUER.nameTh, centerX, y, { align: "center" });
  doc.setFontSize(11.5);
  y += 5.6;
  doc.text(ISSUER.nameEn, centerX, y, { align: "center" });
  doc.setFontSize(10.5);
  y += 5.2;
  doc.text(ISSUER.address, centerX, y, { align: "center" });
  y += 4.6;
  doc.text(ISSUER.taxId, centerX, y, { align: "center" });
  return y;
};

/**
 * ✅ ส่งไฟล์ออก — ใช้ร่วมกันทุกชนิดเอกสาร รองรับ 3 โหมด:
 *   "open"     เปิดดูในแท็บใหม่
 *   "download" ดาวน์โหลดไฟล์ทันที
 *   "blob"     ไม่ทำอะไรกับไฟล์เลย แค่คืน blob/url กลับไปให้ผู้เรียกเอาไปใช้ต่อ
 *              ✅ โหมดนี้คือหัวใจของ "ดูตัวอย่างก่อนออกเอกสาร" — กล่องพรีวิวเอา url ไปแสดงใน <iframe>
 *              และเอา blob ไปสร้าง File สำหรับปุ่มแชร์ (navigator.share) โดยไม่ต้องเปิดแท็บ/ดาวน์โหลดก่อน
 * ⚠️ ชื่อไฟล์ต้องกรองอักขระที่ใช้ในชื่อไฟล์ไม่ได้ออกก่อน (เลขที่เอกสารมี "/" อยู่เสมอ — ถ้าไม่แทนที่
 * เบราว์เซอร์บางตัวจะตีความเป็นโฟลเดอร์แล้วดาวน์โหลดล้มเหลวเงียบๆ)
 * @returns {{ blob: Blob, url: string, fileName: string, safeName: string }}
 */
export const outputDocument = (doc, rawName, mode = "open") => {
  const safeName = String(rawName || "เอกสาร").replace(/[/\\:*?"<>|]/g, "-").trim();
  const fileName = `${safeName}.pdf`;
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  if (mode === "download") {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
  } else if (mode !== "blob") {
    window.open(url, "_blank");
  }
  // ✅ คืนหน่วยความจำหลังเบราว์เซอร์อ่านไฟล์เสร็จ — เดิม GenPDF.js ไม่เคย revoke เลย เปิดหลายใบ
  // ติดกันแล้ว blob ค้างในหน่วยความจำจนกว่าจะปิดแท็บ
  // ⚠️ โหมด "blob" ต้องไม่ revoke เอง — กล่องพรีวิวยังถือ url นี้ค้างไว้แสดงอยู่ (จะนานแค่ไหนก็ได้
  // แล้วแต่ผู้ใช้จะดูนานเท่าไร) ผู้เรียกเป็นคนรับผิดชอบ revoke เองตอนปิดกล่อง/สร้างไฟล์ใหม่ทับ
  if (mode !== "blob") setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return { blob, url, fileName, safeName };
};

// ════════════════════════════════════════════════════════════════════════════
// 🎨 ชุดจัดหน้าเอกสารแบบใหม่ — ใบแจ้งเข้าปฏิบัติงาน · ใบส่งมอบงาน
// 🔁 (17 ต.ค. 2569 ผู้ใช้: "รูปแบบ PDF ไม่สวยเลย ลองจัดวางใหม่ทั้งหมด ให้มืออาชีพ และสวยงาม")
//   • หัวกระดาษแบบหนังสือบริษัท: โลโก้ซ้าย · ชื่อบริษัท (ตัวหนา) + ที่อยู่ ด้านขวาของโลโก้ · เส้นคั่นสีประจำบริษัท
//   • ชื่อเอกสารตัวหนากลางหน้า + ภาษาอังกฤษตัวเล็ก — รู้ทันทีว่าเป็นเอกสารอะไร
//   • เลขที่ (ซ้าย) / วันที่ (ขวา) บรรทัดเดียว · ป้ายหัวจดหมายตัวหนา ค่าเรียงแนวเดียว
//   • กำหนดการ / สิ่งที่ส่งมาด้วย เป็น "ตาราง" มีหัวคอลัมน์ — ข้อความยาวตัดบรรทัดในช่องของตัวเอง ไม่ล้น ไม่เหลื่อม
//   • ย่อหน้าชิดซ้าย ตัดบรรทัดตามคำไทย (ไม่ยืดช่องไฟ) · ส่วนลงนาม 2 ฝั่งเส้นบาง · ท้ายกระดาษบอกเลขที่เอกสาร
// ⚠️ ใช้เฉพาะ 2 เอกสารนี้ — ใบเบิก/ใบขอซื้อยังใช้ drawLetterhead เดิม
// ════════════════════════════════════════════════════════════════════════════
export const LM = 20;
export const RM = 20;
export const CW = 210 - LM - RM;
const INK_RGB = [30, 41, 59];
const SUB_RGB = [100, 116, 139];
const LINE_RGB = [203, 213, 225];
const HEAD_FILL = [241, 245, 249];
const BRAND_RGB = [185, 28, 28];

export const setBold = (doc, on) => doc.setFont("THSarabun", on ? "bold" : "normal");
const ink = (doc, rgb = INK_RGB) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);

/** หัวกระดาษแบบใหม่ — คืนพิกัด y ใต้เส้นคั่น */
export const drawLetterheadModern = (doc) => {
  const top = 11;
  let logoW = 0;
  let logoH = 0;
  try {
    const logo = printAsset(ISSUER.logo);
    const p = doc.getImageProperties(logo);
    logoH = 18;
    logoW = (p.width / p.height) * logoH;
    if (logoW > 34) { logoW = 34; logoH = (p.height / p.width) * logoW; }
    doc.addImage(logo, "PNG", LM, top, logoW, logoH, "letterhead-logo", "MEDIUM");
  } catch {
    logoW = 0; logoH = 0;
  }
  const tx = LM + (logoW ? logoW + 5 : 0);
  const tw = 210 - RM - tx;
  let y = top + 5;
  setBold(doc, true); doc.setFontSize(16.5); ink(doc);
  doc.text(ISSUER.nameTh, tx, y);
  setBold(doc, false); doc.setFontSize(10.5); ink(doc, SUB_RGB);
  y += 4.8; doc.text(ISSUER.nameEn, tx, y);
  doc.setFontSize(10);
  wrapText(doc, ISSUER.address, tw).forEach((ln) => { y += 4.3; doc.text(ln, tx, y); });
  if (ISSUER.taxId) { y += 4.3; doc.text(ISSUER.taxId, tx, y); }
  const ruleY = Math.max(top + logoH, y + 1.2) + 3;
  doc.setDrawColor(BRAND_RGB[0], BRAND_RGB[1], BRAND_RGB[2]); doc.setLineWidth(0.7);
  doc.line(LM, ruleY, 210 - RM, ruleY);
  doc.setDrawColor(LINE_RGB[0], LINE_RGB[1], LINE_RGB[2]); doc.setLineWidth(0.2);
  doc.line(LM, ruleY + 1.1, 210 - RM, ruleY + 1.1);
  ink(doc);
  return ruleY + 1.1;
};

/** ชื่อเอกสารกลางหน้า (ไทยตัวหนา + อังกฤษตัวเล็ก) — คืน y ถัดไป */
export const drawDocTitle = (doc, y, th, en, draw = true) => {
  if (draw) {
    setBold(doc, true); doc.setFontSize(19); ink(doc);
    doc.text(th, 105, y + 8.5, { align: "center" });
    setBold(doc, false); doc.setFontSize(9.5); ink(doc, SUB_RGB);
    if (en) doc.text(en, 105, y + 13, { align: "center", charSpace: 0.8 });
    ink(doc);
  }
  return y + 19;
};

/**
 * หัวจดหมาย: "เลขที่" ซ้าย / "วันที่" ขวา บรรทัดเดียว แล้วตามด้วยแถว ป้าย(ตัวหนา) : ค่า
 * rows: [label, value, { gapBefore }] · label ว่าง = บรรทัดต่อของป้ายก่อนหน้า
 */
export const drawLetterMeta = (doc, { y, fs, lh, draw, docNumber, date, rows }) => {
  const put = (t, x, yy, opt) => { if (draw) doc.text(t, x, yy, opt); };
  doc.setFontSize(fs);
  setBold(doc, true);
  const labels = ["เลขที่", "วันที่", ...rows.map((r) => r[0]).filter(Boolean)];
  const labelW = Math.max(...labels.map((l) => doc.getTextWidth(l))) + 4;
  put("เลขที่", LM, y);
  const dateText = thaiFullDate(date);
  setBold(doc, false);
  const dateW = doc.getTextWidth(dateText);
  put(docNumber || "-", LM + labelW, y);
  put(dateText, 210 - RM, y, { align: "right" });
  setBold(doc, true);
  put("วันที่", 210 - RM - dateW - 3, y, { align: "right" });
  y += lh * 1.25;
  const valueX = LM + labelW;
  const valueW = 210 - RM - valueX;
  rows.forEach(([label, value, opt = {}]) => {
    const text = spaceThaiLatin(value);
    if (!text) return;
    if (opt.gapBefore) y += lh * opt.gapBefore;
    if (label) { setBold(doc, true); put(label, LM, y); }
    setBold(doc, false);
    wrapText(doc, text, valueW).forEach((ln) => { put(ln, valueX, y); y += lh; });
  });
  setBold(doc, false);
  return y;
};




export const SIGN_H = 50;

/** ส่วนลงนาม 2 ฝั่ง — ซ้าย: ลูกค้า (กรอบเส้นบาง) · ขวา: บริษัท (ตรา + ลายเซ็น + ชื่อ/ตำแหน่ง/ติดต่อ) */
export const drawSignatures = (doc, { y, leftTitle, customer, signerName, signerPosition, contact, signatureImage }) => {
  const w = 80;
  const lx = LM;
  const rx = 210 - RM - w;
  const lc = lx + w / 2;
  const rc = rx + w / 2;
  doc.setDrawColor(LINE_RGB[0], LINE_RGB[1], LINE_RGB[2]); doc.setLineWidth(0.3);
  doc.roundedRect(lx, y, w, SIGN_H, 2, 2);
  ink(doc);
  setBold(doc, true); doc.setFontSize(13);
  doc.text(leftTitle, lc, y + 7, { align: "center" });
  setBold(doc, false); doc.setFontSize(12.5);
  doc.text("ลงชื่อ ...............................................", lc, y + 27, { align: "center" });
  doc.text("( ............................................... )", lc, y + 34, { align: "center" });
  doc.text("วันที่ ........ / ........ / ........", lc, y + 41, { align: "center" });
  doc.setFontSize(10); ink(doc, SUB_RGB);
  wrapText(doc, spaceThaiLatin(customer), w - 6).slice(0, 1).forEach((ln) => doc.text(ln, lc, y + 47, { align: "center" }));
  ink(doc);

  doc.setFontSize(13);
  doc.text("ขอแสดงความนับถือ", rc, y + 7, { align: "center" });
  try {
    const stamp = printAsset(ISSUER.stamp);
    const sp = doc.getImageProperties(stamp);
    let sw = 27;
    let sh = (sp.height / sp.width) * sw;
    if (sh > 17) { sh = 17; sw = (sp.width / sp.height) * sh; }
    // ตราอยู่ซ้ายของช่องเซ็น ขอบล่างเหนือเส้นลงชื่อ — ไม่ทับคำลงท้ายและชื่อผู้ลงนาม
    doc.addImage(stamp, "PNG", rx - 4, y + 25.5 - sh, sw, sh, "company-stamp", "MEDIUM");
  } catch { /* ไม่มีตรา = เว้นที่ให้ประทับมือ */ }
  drawSignatureOnLine(doc, signatureImage, { centerX: rc + 4, lineY: y + 26.2, maxW: 46, maxH: 13 });
  doc.setFontSize(12.5);
  doc.text("...............................................", rc, y + 27, { align: "center" });
  doc.text(`( ${spaceThaiLatin(signerName) || "..............................................."} )`, rc, y + 34, { align: "center" });
  doc.text(spaceThaiLatin(signerPosition) || "", rc, y + 40.5, { align: "center" });
  doc.setFontSize(10); ink(doc, SUB_RGB);
  wrapText(doc, spaceThaiLatin(contact), w + 14).slice(0, 2).forEach((ln, i) => doc.text(ln, rc, y + 46 + i * 4, { align: "center" }));
  ink(doc);
};

/** ท้ายกระดาษ: ชื่อเอกสาร + เลขที่ (ซ้าย) · ชื่อบริษัท (ขวา) */
export const drawFooter = (doc, label) => {
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(LINE_RGB[0], LINE_RGB[1], LINE_RGB[2]); doc.setLineWidth(0.2);
    doc.line(LM, 284, 210 - RM, 284);
    setBold(doc, false); doc.setFontSize(9); ink(doc, SUB_RGB);
    doc.text(label, LM, 288.5);
    doc.text(pages > 1 ? `${ISSUER.nameTh} · หน้า ${p}/${pages}` : ISSUER.nameTh, 210 - RM, 288.5, { align: "right" });
    ink(doc);
  }
};

/** พื้นที่เนื้อหาสิ้นสุดที่นี่ (เหนือท้ายกระดาษ) */
export const CONTENT_BOTTOM = 282;



/**
 * ── การจัดหน้าแบบหลายหน้า (17 ต.ค. 2569 ผู้ใช้: "ตัวหนังสือไม่ควรเล็กเกินไปเมื่อเพิ่มหลายแถว · ถ้ามีหน้าที่ 2
 *    ไม่ควรโล่ง ให้มีหัวกระดาษและรายละเอียดส่วนอื่นด้วย") ───────────────────────────────────────────
 *   • ตัวอักษรไม่ต่ำกว่า 13pt — ยาวเกินหน้าเดียว = ขึ้นหน้าใหม่ แทนการย่อจนอ่านยาก
 *   • หน้าถัดไปมีหัวกระดาษเต็มเหมือนหน้าแรก (ผู้ใช้: "หัวกระดาษหน้า 2 ควรเหมือนหน้าแรก") + "ชื่อเอกสาร (ต่อ) · เลขที่" และตารางแสดงหัวคอลัมน์ซ้ำ
 *   • ย่อหน้าปิด + คำลงท้าย "ติดไปกับ" ส่วนลงนามเสมอ — ไม่มีหน้าที่มีแต่ช่องเซ็นโดดๆ
 */
export const MIN_FLOW_SCALES = [
  { fs: 14, lh: 6.4 },
  { fs: 13.5, lh: 6.1 },
  { fs: 13, lh: 5.85 },
];


/** ตัวเดินหน้ากระดาษ — วัด (draw:false) กับวาดจริง (draw:true) ผ่านเส้นทางเดียวกัน จำนวนหน้าจึงตรงกันเสมอ */
export const createFlow = (doc, { draw, fs, lh, y, title, docNumber, headerY }) => {
  const f = { draw, fs, lh, y, pages: 1, bottom: CONTENT_BOTTOM };
  f.newPage = () => {
    f.pages += 1;
    if (draw) {
      doc.addPage();
      drawLetterheadModern(doc);
      setBold(doc, false); doc.setFontSize(10); ink(doc, SUB_RGB);
      doc.text(`${title} (ต่อ) · เลขที่ ${docNumber || "-"}`, 210 - RM, headerY + 5.5, { align: "right" });
    }
    f.y = headerY + 5.5 + lh * 1.5;
    setBold(doc, false); doc.setFontSize(fs); ink(doc);
  };
  /** ต้องมีที่ว่างอย่างน้อย h มม. นับจากบรรทัดปัจจุบัน ไม่งั้นขึ้นหน้าใหม่ */
  f.need = (h) => { if (f.y + h > f.bottom) f.newPage(); };
  return f;
};

/** ย่อหน้า (บรรทัดแรกเยื้อง) — ขึ้นหน้าใหม่ได้ระหว่างบรรทัด */
export const flowParagraph = (doc, f, text, indent = 14) => {
  const t = spaceThaiLatin(text);
  if (!t) return;
  doc.setFontSize(f.fs);
  wrapParagraph(doc, t, CW - indent, CW).forEach((ln, i) => {
    f.need(0);
    if (f.draw) doc.text(ln, LM + (i === 0 ? indent : 0), f.y);
    f.y += f.lh;
  });
};

/** ตาราง — แถวไม่ถูกตัดครึ่ง · ขึ้นหน้าใหม่แล้วพิมพ์หัวคอลัมน์ซ้ำ · f.y = ขอบบนของตาราง → จบที่ขอบล่าง */
export const flowTable = (doc, f, { cols, rows }) => {
  const padX = 2.2;
  const rowLh = f.lh * 0.92;
  const widths = cols.map((c, i) => (i === cols.length - 1 ? CW - cols.slice(0, -1).reduce((n, x) => n + x.w, 0) : c.w));
  const xs = widths.reduce((acc, w, i) => [...acc, acc[i] + w], [LM]);
  const prep = (cells, head) => {
    doc.setFontSize(f.fs - 0.5); setBold(doc, head);
    const lines = cells.map((c, i) => wrapText(doc, spaceThaiLatin(c), widths[i] - padX * 2));
    return { lines, h: Math.max(1, ...lines.map((l) => l.length)) * rowLh + 3.6, head };
  };
  const drawRow = ({ lines, h, head }) => {
    if (f.draw) {
      doc.setFontSize(f.fs - 0.5); setBold(doc, head);
      doc.setLineWidth(0.2); doc.setDrawColor(LINE_RGB[0], LINE_RGB[1], LINE_RGB[2]);
      if (head) { doc.setFillColor(HEAD_FILL[0], HEAD_FILL[1], HEAD_FILL[2]); doc.rect(LM, f.y, CW, h, "F"); }
      doc.rect(LM, f.y, CW, h);
      for (let i = 1; i < xs.length - 1; i += 1) doc.line(xs[i], f.y, xs[i], f.y + h);
      lines.forEach((ls, i) => {
        const align = head ? "center" : cols[i].align || "left";
        const x = align === "center" ? xs[i] + widths[i] / 2 : align === "right" ? xs[i + 1] - padX : xs[i] + padX;
        ls.forEach((ln, li) => doc.text(ln, x, f.y + 1.8 + rowLh * (li + 0.78), { align }));
      });
    }
    f.y += h;
  };
  const head = prep(cols.map((c) => c.title), true);
  const body = rows.map((r) => prep(r, false));
  // หัวตารางต้องมีแถวแรกตามมาด้วยในหน้าเดียวกัน
  if (f.y + head.h + (body[0]?.h || 0) > f.bottom) { f.newPage(); f.y -= f.lh * 0.8; }
  drawRow(head);
  body.forEach((r) => {
    if (f.y + r.h > f.bottom) { f.newPage(); f.y -= f.lh * 0.8; drawRow(head); }
    drawRow(r);
  });
  setBold(doc, false); doc.setFontSize(f.fs);
};

/** ป้ายตัวหนา + ข้อความ (หมายเหตุ) */
export const flowLabeled = (doc, f, label, text) => {
  const lines = String(text || "").split("\n").map((s) => spaceThaiLatin(s)).filter(Boolean);
  if (!lines.length) return;
  doc.setFontSize(f.fs);
  setBold(doc, true);
  const lw = doc.getTextWidth(label) + 3;
  f.need(0);
  if (f.draw) doc.text(label, LM, f.y);
  setBold(doc, false);
  lines.flatMap((ln) => wrapText(doc, ln, CW - lw)).forEach((ln) => { f.need(0); if (f.draw) doc.text(ln, LM + lw, f.y); f.y += f.lh; });
};

/**
 * วางเอกสารทั้งฉบับ: body(f) = ส่วนเนื้อหาที่ไหลได้ · closing(f) = ส่วนท้ายที่ต้องอยู่หน้าเดียวกับช่องเซ็น
 * เลือกตัวอักษรใหญ่สุดที่จบหน้าเดียว (ไม่ต่ำกว่า 13pt) · ไม่จบ = หลายหน้าที่ 13.5pt
 */
export const placeFlowLetter = (doc, { headerY, firstY, title, docNumber, body, closing, sign, footerLabel }) => {
  const signY = CONTENT_BOTTOM - SIGN_H;
  const run = (s, draw) => {
    const f = createFlow(doc, { draw, fs: s.fs, lh: s.lh, y: firstY(s, draw), title, docNumber, headerY });
    body(f);
    // วัดส่วนท้ายก่อน — ไม่พอกับช่องเซ็นในหน้านี้ = ยกส่วนท้ายทั้งก้อนไปหน้าใหม่ (ไม่ปล่อยหน้ามีแต่ช่องเซ็น)
    const probe = { ...f, draw: false, y: 0, bottom: Infinity, need: () => {}, newPage: () => {} };
    closing(probe);
    if (f.y + probe.y + 6 > signY) f.newPage();
    closing(f);
    return f.pages;
  };
  const one = MIN_FLOW_SCALES.find((s) => run(s, false) === 1);
  const scale = one || MIN_FLOW_SCALES[1];
  run(scale, true);
  drawSignatures(doc, { ...sign, y: signY });
  drawFooter(doc, footerLabel);
};

/**
 * สร้างไฟล์ PDF ใบส่งมอบงาน (รูปแบบใหม่ 17 ต.ค. 2569 — ดูชุดจัดหน้าด้านบน)
 * @param {"open"|"download"|"blob"} opts.mode
 */
export const generateDeliveryNotePdf = async ({ jsPDF, thSarabunFont, form, mode = "open" }) => {
  moment.locale("th");
  await preparePrintAssets();
  const doc = createDocument(jsPDF, thSarabunFont);
  const headerY = drawLetterheadModern(doc);
  const attachments = (form.attachments || []).filter((a) => (a.text || "").trim());

  placeFlowLetter(doc, {
    headerY,
    title: "ใบส่งมอบงาน",
    docNumber: form.docNumber,
    firstY: ({ fs, lh }, draw) => {
      const y = drawDocTitle(doc, headerY, "ใบส่งมอบงาน", "DELIVERY NOTE", draw);
      return drawLetterMeta(doc, {
        y: y + 2, fs, lh, draw, docNumber: form.docNumber, date: form.issuedAt,
        rows: [
          ["เรื่อง", form.subject],
          ["โครงการ", form.site],
          ["", form.customerCompany],
          ["", form.customerAddress],
          ["", form.customerTaxId ? `เลขประจำตัวผู้เสียภาษี ${form.customerTaxId}` : ""],
          ["เรียน", form.attention, { gapBefore: 0.3 }],
          ["อ้างถึง", form.reference],
        ],
      }) + lh;
    },
    body: (f) => {
      flowParagraph(doc, f, form.body);
      if (!attachments.length) return;
      f.y += f.lh * 0.9;
      f.need(f.lh * 4);
      setBold(doc, true);
      if (f.draw) doc.text("สิ่งที่ส่งมาด้วย", LM, f.y);
      setBold(doc, false);
      f.y += 2.8;
      flowTable(doc, f, {
        cols: [{ title: "ลำดับ", w: 14, align: "center" }, { title: "รายการ", w: CW - 14 - 28 }, { title: "จำนวน", align: "center" }],
        rows: attachments.map((a, i) => [String(i + 1), a.text, a.qty || "-"]),
      });
      f.y += f.lh * 0.55;
    },
    closing: (f) => {
      f.y += f.lh * 0.9;
      f.need(0);
      if (f.draw) doc.text("จึงเรียนมาเพื่อโปรดพิจารณา และขอขอบพระคุณมา ณ โอกาสนี้", LM + 14, f.y);
    },
    sign: {
      leftTitle: "ลงนามรับมอบงาน",
      customer: form.customerCompany || form.site,
      signerName: form.signerName, signerPosition: form.signerPosition,
      contact: ISSUER.nameTh,
      signatureImage: form.signatureImage,
    },
    footerLabel: `ใบส่งมอบงาน · เลขที่ ${form.docNumber || "-"}`,
  });

  return outputDocument(doc, `ใบส่งมอบงาน ${form.docNumber || ""} ${form.site || ""}`, mode);
};
