/**
 * billing.js (ฝั่งหน้าจอ) — สถานะ/ยอดของการวางบิลและรับเงิน
 *
 * ⚠️ ไฟล์นี้ต้อง "เหมือน" da-app-server/utils/billing.js เป๊ะๆ ในส่วนที่ซ้ำกัน (round2 / paidTotal /
 * billingStatus) — 2 repo แยกกันจึงแชร์โมดูลกันตรงๆ ไม่ได้ ถ้าแก้เกณฑ์ที่ไหนต้องแก้อีกที่ทุกครั้ง
 * ไม่งั้นตัวเลขบนจอกับตัวเลขในแจ้งเตือนจะไม่ตรงกัน ซึ่งผู้ใช้จับได้ทันที
 *
 * ⚠️ ฝั่งนี้ "ไม่คำนวณยอดภาษีเอง" โดยตั้งใจ — VAT / หัก ณ ที่จ่าย / ยอดสุทธิ คำนวณที่ server เท่านั้น
 * แล้วเก็บค่าไว้ (ดูเหตุผลที่ models/Events.js) หน้าจอมีหน้าที่แค่ "แสดงสิ่งที่บันทึกไว้จริง"
 * ยกเว้น previewAmounts ด้านล่างที่ใช้โชว์ตัวอย่างระหว่างพิมพ์เท่านั้น ไม่ได้ถูกส่งไปบันทึก
 */

export const round2 = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Number(`${Math.round(Number(`${v}e2`))}e-2`);
};

export const baht = (n) => `฿${round2(n).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const paidTotal = (billing) =>
  round2((billing?.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0));

/** ตัวอย่างยอดระหว่างพิมพ์ในฟอร์ม — สูตรเดียวกับ computeBillingAmounts ฝั่ง server */
export const previewAmounts = ({ amountBeforeVat, vatRate = 7, whtRate = 3 }) => {
  const base = round2(amountBeforeVat);
  const vr = Number.isFinite(Number(vatRate)) ? Number(vatRate) : 0;
  const wr = Number.isFinite(Number(whtRate)) ? Number(whtRate) : 0;
  const vatAmount = round2((base * vr) / 100);
  const whtAmount = round2((base * wr) / 100);
  return { amountBeforeVat: base, vatAmount, whtAmount, netAmount: round2(base + vatAmount - whtAmount) };
};

export const BILLING_STATE_META = {
  not_invoiced: { label: "ยังไม่วางบิล", color: "#64748b" },
  unpaid: { label: "รอชำระ", color: "#3b82f6" },
  partial: { label: "ชำระบางส่วน", color: "#f59e0b" },
  overdue: { label: "เลยกำหนดชำระ", color: "#dc2626" },
  paid: { label: "ชำระครบแล้ว", color: "#10b981" },
};

/**
 * สถานะของใบวางบิล — เป็นค่าคำนวณเสมอ ไม่เก็บลงฐานข้อมูล
 * ⚠️ "เลยกำหนด" เปลี่ยนเองตามเวลาโดยไม่มีใครแตะข้อมูลเลย จึงเป็นไปไม่ได้ที่จะเก็บให้ถูกตลอด
 */
export const billingStatus = (billing, now = new Date()) => {
  if (!billing?.invoicedAt) {
    return { state: "not_invoiced", label: BILLING_STATE_META.not_invoiced.label, net: 0, paid: 0, outstanding: 0 };
  }
  const net = round2(billing.netAmount);
  const paid = paidTotal(billing);
  const outstanding = round2(net - paid);

  // ⚠️ <= 0 ไม่ใช่ === 0 — ลูกค้าโอนเกินเศษสตางค์เกิดขึ้นจริง ถ้าเทียบเท่ากันเป๊ะ ใบนั้นจะค้าง
  // อยู่ที่ "ชำระบางส่วน" ตลอดกาลทั้งที่รับเงินครบแล้ว
  if (net > 0 && outstanding <= 0) {
    return { state: "paid", label: BILLING_STATE_META.paid.label, net, paid, outstanding: 0 };
  }
  const due = billing.dueAt ? new Date(billing.dueAt) : null;
  const overdueDays = due ? Math.floor((now - due) / 86400000) : 0;
  if (due && overdueDays > 0) {
    return { state: "overdue", label: `เลยกำหนดชำระ ${overdueDays} วัน`, net, paid, outstanding, overdueDays };
  }
  if (paid > 0) return { state: "partial", label: BILLING_STATE_META.partial.label, net, paid, outstanding };
  return { state: "unpaid", label: BILLING_STATE_META.unpaid.label, net, paid, outstanding };
};

/**
 * สรุปสถานะการวางบิลของ "ทั้งสัญญา/ทั้งงาน" จากงานรายครั้งที่อยู่ข้างใน
 *
 * ⚠️ วางบิลเป็นรายครั้ง (สัญญา 4 ครั้ง = 4 ใบ) แต่ตารางภาพรวมงานแสดงสัญญาละ 1 แถว จึงต้องยุบให้เหลือ
 * สถานะเดียวต่อแถว — ใช้หลัก "อาการหนักสุดครองแถว" เหมือนที่หน้าอื่นในระบบทำกับสถานะงาน
 * (เลยกำหนด > ชำระบางส่วน > รอชำระ > ยังไม่วางบิล > ชำระครบ)
 *
 * ⚠️ "ยังไม่วางบิล" อยู่เหนือ "ชำระครบ" โดยตั้งใจ — สัญญาที่วางบิลครบ 3 ใบแต่ยังขาดใบที่ 4 ยังไม่จบงาน
 * ถ้าให้ "ชำระครบ" ชนะจะขึ้นเขียวทั้งแถวทั้งที่ยังเก็บเงินไม่ครบสัญญา ซึ่งเป็นการรายงานที่หลอกตา
 * ⚠️ นับเฉพาะครั้งที่ลงตารางจริง (ไม่รวมแผนงานล่วงหน้า) — ครั้งที่ยังไม่ได้เข้าไปทำยังไม่ถึงคิววางบิล
 */
const RANK = { overdue: 0, partial: 1, unpaid: 2, not_invoiced: 3, paid: 4 };

export const contractBillingSummary = (visits = [], now = new Date()) => {
  const real = visits.filter((v) => !v.unscheduled);
  if (real.length === 0) return null;

  let net = 0, paid = 0, outstanding = 0, invoicedCount = 0, overdueDays = 0;
  let worst = null;
  real.forEach((v) => {
    const st = billingStatus(v.billing, now);
    if (st.state !== "not_invoiced") {
      invoicedCount += 1;
      net = round2(net + st.net);
      paid = round2(paid + st.paid);
      outstanding = round2(outstanding + Math.max(0, st.outstanding));
      if (st.overdueDays > overdueDays) overdueDays = st.overdueDays;
    }
    if (!worst || RANK[st.state] < RANK[worst]) worst = st.state;
  });

  return {
    state: worst,
    label: BILLING_STATE_META[worst].label,
    color: BILLING_STATE_META[worst].color,
    net, paid, outstanding, overdueDays,
    invoicedCount,
    totalCount: real.length,
  };
};
