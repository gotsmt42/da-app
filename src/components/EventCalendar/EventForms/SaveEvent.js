export const getSaveEventToDB = async ({ newEvent, EventService }) => {
  // ตรวจสอบข้อมูลเบื้องต้นแบบเร็ว — รองรับ 2 รูปแบบ:
  // 1) วันเดียว/ช่วงต่อเนื่อง: ต้องมี start/end/date
  // 2) หลายวันไม่ติดกัน: ต้องมี dates เป็น array อย่างน้อย 1 รายการ
  const hasSingleDate = newEvent?.start && newEvent?.end && newEvent?.date;
  const hasMultiDates  = Array.isArray(newEvent?.dates) && newEvent.dates.length > 0;
  if (!hasSingleDate && !hasMultiDates) {
    console.warn("⚠️ ข้อมูลไม่ครบ:", newEvent);
    return null; // ไม่ต้อง throw error เพื่อให้ flow ไม่สะดุด
  }

  try {
    return await EventService.AddEvent(newEvent);
  } catch (error) {
    console.error("❌ บันทึกแผนงานไม่สำเร็จ:", error.message);
    return null; // ส่งค่า null แทนการ throw เพื่อให้ caller จัดการได้เร็ว
  }
};
