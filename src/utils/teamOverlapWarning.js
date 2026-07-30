// ✅ เดิม backend เคยบล็อกไม่ให้ลาก/ขยายงานไปทับวันที่ทีม/ช่างคนเดียวกันมีงานอื่นอยู่แล้ว
// (double-booking) — ตัดออกไปแล้วตามที่ผู้ใช้ขอ (1 ทีมรับหลายงานในวันเดียวกันได้ตามปกติ ไม่ควรบล็อก)
// แต่ยังอยากให้แอดมิน/ช่าง "รู้ตัว" เฉยๆ ไม่บล็อกการทำงาน — เช็คฝั่ง client จากข้อมูล events ที่มีอยู่
// แล้วในเครื่อง (ไม่ต้องยิง API เพิ่ม) แล้วโชว์เป็น toast เบาๆ ปิดเองอัตโนมัติ ไม่ต้องกดปิดเอง
export const showTeamOverlapWarning = ({ Swal, moment, events, movedEvent, start, end }) => {
  if (!Swal || !moment) return;
  const resPerson = movedEvent.extendedProps?.resPerson;
  const team = movedEvent.extendedProps?.team;
  if (!resPerson && !team) return;

  const overlap = (events || []).find((e) => {
    if (!e || String(e.id) === String(movedEvent.id)) return false;
    if (e.extendedProps?.isHoliday) return false;
    const sameResPerson = resPerson && e.resPerson === resPerson;
    const sameTeam = !sameResPerson && team && e.team === team;
    if (!sameResPerson && !sameTeam) return false;
    if (!e.start) return false;
    const eStart = moment(e.start).format("YYYY-MM-DD");
    const eEnd = moment(e.end || e.start).format("YYYY-MM-DD");
    // ✅ เทียบซ้อนทับกันระดับวัน (ไม่สนเวลา) — งานที่กำลังลาก/ขยายอยู่ [start, end] ทับกับงานอื่น [eStart, eEnd]
    return moment(start).isSameOrBefore(eEnd) && moment(eStart).isSameOrBefore(end);
  });
  if (!overlap) return;

  Swal.fire({
    toast: true,
    position: "top-end",
    icon: "warning",
    title: `${team || "ทีมนี้"} มีอีกงานในช่วงนี้อยู่แล้ว: ${overlap.title || "งาน"}`,
    showConfirmButton: false,
    timer: 3500,
    timerProgressBar: true,
  });
};
