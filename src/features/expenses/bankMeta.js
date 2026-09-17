/**
 * bankMeta.js — ธนาคาร/บัญชีรับเงินของผู้เบิก (ใบเคลม)
 *
 * ⚠️ BANKS ต้องตรงกับ da-app-server/src/config/banks.js (code / digits) — เพิ่มธนาคารต้องแก้ทั้งสองฝั่ง
 * ไม่งั้นผู้ใช้เลือกธนาคารที่ server ไม่รู้จัก แล้วบันทึกไม่ผ่านโดยไม่รู้สาเหตุ
 * ⚠️ ฝั่งนี้ตรวจแค่ให้ผู้ใช้รู้ตัวก่อนกด — server ตรวจซ้ำทุกครั้งเสมอ
 */
export const BANKS = [
  { code: "KBANK", name: "ธนาคารกสิกรไทย", short: "กสิกรไทย", color: "#138f2d", rgb: [19, 143, 45], mark: "K", darkText: false, digits: [10] },
  { code: "SCB", name: "ธนาคารไทยพาณิชย์", short: "ไทยพาณิชย์", color: "#4e2e7f", rgb: [78, 46, 127], mark: "SCB", darkText: false, digits: [10] },
  { code: "BBL", name: "ธนาคารกรุงเทพ", short: "กรุงเทพ", color: "#1e4598", rgb: [30, 69, 152], mark: "BBL", darkText: false, digits: [10] },
  { code: "KTB", name: "ธนาคารกรุงไทย", short: "กรุงไทย", color: "#1ba5e1", rgb: [27, 165, 225], mark: "KTB", darkText: false, digits: [10] },
  { code: "BAY", name: "ธนาคารกรุงศรีอยุธยา", short: "กรุงศรี", color: "#fec43b", rgb: [254, 196, 59], mark: "BAY", darkText: true, digits: [10] },
  { code: "TTB", name: "ธนาคารทหารไทยธนชาต (ttb)", short: "ttb", color: "#1279be", rgb: [18, 121, 190], mark: "ttb", darkText: false, digits: [10] },
  { code: "GSB", name: "ธนาคารออมสิน", short: "ออมสิน", color: "#eb198d", rgb: [235, 25, 141], mark: "GSB", darkText: false, digits: [12] },
  { code: "BAAC", name: "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร (ธ.ก.ส.)", short: "ธ.ก.ส.", color: "#4b9b1d", rgb: [75, 155, 29], mark: "ธกส", darkText: false, digits: [12] },
  { code: "GHB", name: "ธนาคารอาคารสงเคราะห์", short: "อาคารสงเคราะห์", color: "#f57d23", rgb: [245, 125, 35], mark: "ธอส", darkText: false, digits: [12] },
  { code: "UOB", name: "ธนาคารยูโอบี", short: "ยูโอบี", color: "#0b3979", rgb: [11, 57, 121], mark: "UOB", darkText: false, digits: [10] },
  { code: "CIMB", name: "ธนาคารซีไอเอ็มบี ไทย", short: "ซีไอเอ็มบี", color: "#7e2f36", rgb: [126, 47, 54], mark: "CIMB", darkText: false, digits: [10] },
  { code: "KKP", name: "ธนาคารเกียรตินาคินภัทร", short: "เกียรตินาคินภัทร", color: "#199cc5", rgb: [25, 156, 197], mark: "KKP", darkText: false, digits: [10] },
  { code: "LHB", name: "ธนาคารแลนด์ แอนด์ เฮ้าส์", short: "แลนด์ แอนด์ เฮ้าส์", color: "#6d6e71", rgb: [109, 110, 113], mark: "LH", darkText: false, digits: [10] },
  { code: "TISCO", name: "ธนาคารทิสโก้", short: "ทิสโก้", color: "#12558c", rgb: [18, 85, 140], mark: "TIS", darkText: false, digits: [10] },
  { code: "ICBC", name: "ธนาคารไอซีบีซี (ไทย)", short: "ไอซีบีซี", color: "#c50f1c", rgb: [197, 15, 28], mark: "ICBC", darkText: false, digits: [10] },
  { code: "IBANK", name: "ธนาคารอิสลามแห่งประเทศไทย", short: "อิสลาม", color: "#184615", rgb: [24, 70, 21], mark: "IBK", darkText: false, digits: [10] },
  { code: "PROMPTPAY", name: "พร้อมเพย์", short: "พร้อมเพย์", color: "#023f88", rgb: [2, 63, 136], mark: "PP", darkText: false, digits: [10, 13] },
];

/**
 * ⚠️ mark = ตัวย่อบนสัญลักษณ์ธนาคาร (ไม่ใช่ไฟล์โลโก้จริงของธนาคาร ซึ่งเป็นเครื่องหมายการค้า
 * ที่เอามาใส่ในระบบเองไม่ได้) — ใช้สีประจำธนาคาร + ตัวย่อ ซึ่งคนไทยแยกออกทันทีจากสีอยู่แล้ว
 * ⚠️ rgb ต้องตรงกับ color — ฝั่ง PDF (jsPDF) รับเฉพาะค่า RGB ไม่รับ hex string
 */
export const bankMeta = (code) =>
  BANKS.find((b) => b.code === code)
  || { code: code || "", name: code || "ไม่ระบุธนาคาร", short: code || "-", color: "#64748b", rgb: [100, 116, 139], mark: "?", darkText: false, digits: [] };

export const digitsOnly = (v) => String(v || "").replace(/\D/g, "");

/** @returns {string} ข้อความผิดพลาดภาษาไทย หรือ "" ถ้าถูกต้อง (ตรรกะเดียวกับ server) */
export const validateAccount = (bankCode, accountNo) => {
  const bank = BANKS.find((b) => b.code === bankCode);
  if (!bank) return "กรุณาเลือกธนาคาร";
  const no = digitsOnly(accountNo);
  if (!no) return "กรุณากรอกเลขบัญชี";
  if (!bank.digits.includes(no.length)) {
    return bank.code === "PROMPTPAY"
      ? "พร้อมเพย์ต้องเป็นเบอร์มือถือ 10 หลัก หรือเลขบัตรประชาชน 13 หลัก"
      : `เลขบัญชี${bank.short}ต้องมี ${bank.digits.join(" หรือ ")} หลัก (กรอกมา ${no.length} หลัก)`;
  }
  return "";
};

/**
 * เลขบัญชีแบบอ่านง่าย — ตาคนอ่านเลข 10 หลักติดกันแล้วสลับตัวเลขง่ายมาก โดยเฉพาะตอนพิมพ์ตามเพื่อโอนเงิน
 * ⚠️ จัดกลุ่มตามรูปแบบที่คนไทยคุ้น (xxx-x-xxxxx-x สำหรับ 10 หลัก) ไม่ใช่ตัดทีละ 4 ตัวมั่วๆ
 */
export const formatAccountNo = (no) => {
  const d = digitsOnly(no);
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 4)}-${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12) return `${d.slice(0, 3)}-${d.slice(3, 4)}-${d.slice(4, 10)}-${d.slice(10)}`;
  if (d.length === 13) return `${d.slice(0, 1)}-${d.slice(1, 5)}-${d.slice(5, 10)}-${d.slice(10, 12)}-${d.slice(12)}`;
  return d;
};

/** ข้อความบัญชีแบบบรรทัดเดียว — ใช้ทั้งบนหน้าจอ, ใน PDF และตอนกดคัดลอก */
export const payToText = (payTo) => {
  if (!payTo?.accountNo) return "";
  const name = payTo.bankName || bankMeta(payTo.bankCode).name;
  return [name, formatAccountNo(payTo.accountNo), payTo.accountName].filter(Boolean).join(" · ");
};
