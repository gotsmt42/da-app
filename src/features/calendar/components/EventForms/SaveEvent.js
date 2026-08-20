export const getSaveEventToDB = async ({ newEvent, EventService }) => {
  // ตรวจสอบข้อมูลเบื้องต้นแบบเร็ว — รองรับ 2 รูปแบบ:
  // 1) วันเดียว/ช่วงต่อเนื่อง: ต้องมี start/end/date
  // 2) หลายวันไม่ติดกัน: ต้องมี dates เป็น array อย่างน้อย 1 รายการ
  const hasSingleDate = newEvent?.start && newEvent?.end && newEvent?.date;
  const hasMultiDates  = Array.isArray(newEvent?.dates) && newEvent.dates.length > 0;
  if (!hasSingleDate && !hasMultiDates) {
    throw new Error("ข้อมูลวันที่ไม่ครบ ไม่สามารถบันทึกได้");
  }

  // ✅ เดิม catch แล้ว return null แทนการ throw ("ไม่ต้องให้ flow สะดุด") ทำให้ error จริงจาก backend
  // (เช่น 409 ช่างชนกัน) ไปไม่ถึง caller เลย — AddEvent.js ไม่เช็ค return value จึงขึ้น "บันทึกสำเร็จ"
  // ทั้งที่ไม่ได้บันทึกจริง ปล่อยให้ error หลุดขึ้นไปให้ caller (ที่มี try/catch + showSaveError อยู่แล้ว)
  // จัดการแทน
  return EventService.AddEvent(newEvent);
};
