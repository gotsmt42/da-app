/**
 * deviceNames — แปลงรหัสรุ่นเครื่อง (ที่เบราว์เซอร์ส่งมา เช่น SM-S938B) เป็นชื่อที่คนรู้จัก (Galaxy S25 Ultra)
 *
 * ✅ ผู้ใช้แจ้ง (5 ต.ค. 2569): "เข้าด้วย S25 ULTRA แต่ขึ้น Android 10"
 * ⚠️ ตัดตัวอักษรท้ายรหัส (ประเทศ/ผู้ให้บริการ เช่น B, U, N, 0, E, DS) ก่อนเทียบเสมอ
 * ⚠️ ไม่รู้จักรหัส = แสดงรหัสเดิม (ไม่เดา)
 */
const SAMSUNG = {
  // Galaxy S
  G991: "Galaxy S21", G996: "Galaxy S21+", G998: "Galaxy S21 Ultra", G990: "Galaxy S21 FE",
  S901: "Galaxy S22", S906: "Galaxy S22+", S908: "Galaxy S22 Ultra",
  S911: "Galaxy S23", S916: "Galaxy S23+", S918: "Galaxy S23 Ultra", S711: "Galaxy S23 FE",
  S921: "Galaxy S24", S926: "Galaxy S24+", S928: "Galaxy S24 Ultra", S721: "Galaxy S24 FE",
  S931: "Galaxy S25", S936: "Galaxy S25+", S938: "Galaxy S25 Ultra", S937: "Galaxy S25 Edge", S731: "Galaxy S25 FE",
  N981: "Galaxy Note20", N986: "Galaxy Note20 Ultra",
  // Galaxy Z
  F926: "Galaxy Z Fold3", F711: "Galaxy Z Flip3", F936: "Galaxy Z Fold4", F721: "Galaxy Z Flip4",
  F946: "Galaxy Z Fold5", F731: "Galaxy Z Flip5", F956: "Galaxy Z Fold6", F741: "Galaxy Z Flip6",
  F966: "Galaxy Z Fold7", F766: "Galaxy Z Flip7", F761: "Galaxy Z Flip7 FE",
  // Galaxy A / M
  A546: "Galaxy A54", A556: "Galaxy A55", A566: "Galaxy A56",
  A346: "Galaxy A34", A356: "Galaxy A35", A366: "Galaxy A36",
  A245: "Galaxy A24", A256: "Galaxy A25", A266: "Galaxy A26",
  A145: "Galaxy A14", A146: "Galaxy A14 5G", A155: "Galaxy A15", A156: "Galaxy A15 5G", A165: "Galaxy A16", A166: "Galaxy A16 5G",
  A055: "Galaxy A05", A057: "Galaxy A05s", A065: "Galaxy A06", A045: "Galaxy A04", A047: "Galaxy A04s",
  A536: "Galaxy A53", A336: "Galaxy A33", A235: "Galaxy A23", A135: "Galaxy A13", A525: "Galaxy A52", A526: "Galaxy A52 5G", A528: "Galaxy A52s",
  // Galaxy Tab
  X710: "Galaxy Tab S9", X810: "Galaxy Tab S9+", X910: "Galaxy Tab S9 Ultra", X510: "Galaxy Tab S9 FE",
  X820: "Galaxy Tab S10+", X920: "Galaxy Tab S10 Ultra", X210: "Galaxy Tab A9+", X110: "Galaxy Tab A9",
};

/** @returns {string} ชื่อรุ่นที่คนรู้จัก หรือ "" ถ้าไม่รู้จัก */
export const marketingName = (vendor, model) => {
  const m = String(model || "").trim();
  if (!m) return "";
  const sm = m.match(/^SM-([A-Z]\d{3})/i);
  if (sm) return SAMSUNG[sm[1].toUpperCase()] ? `Samsung ${SAMSUNG[sm[1].toUpperCase()]}` : "";
  return "";
};
