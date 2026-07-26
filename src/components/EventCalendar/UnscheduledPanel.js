import { forwardRef, useEffect, useRef, useState } from "react";
import { Draggable } from "@fullcalendar/interaction";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faPen,
  faTrash,
  faCalendarCheck,
  faGripVertical,
  faChevronLeft,
  faChevronRight,
  faEllipsisVertical,
} from "@fortawesome/free-solid-svg-icons";
import moment from "moment";
import "moment/locale/th";

// ✅ งาน "วางแผนล่วงหน้า" (ยังไม่ลงตาราง) แยกเป็นแผงต่างหาก ไม่ปนกับปฏิทินจริง — เพราะยังไม่มี
// วันที่แน่นอน (backend ก็กันไม่ให้ปนอยู่แล้ว ดู unscheduled: {$ne:true} ใน GET /events)
// การ์ดแต่ละใบลากวางบนปฏิทินได้เลย (FullCalendar Draggable + droppable บนปฏิทินหลัก จับคู่กัน
// ผ่าน eventReceive) หรือกดปุ่ม "ลงตาราง" เพื่อเลือกวันที่เองก็ได้ ไม่ต้องลาก
//
// ✅ forwardRef: ให้ EventCalendar/index.js เอา DOM node ของแผงนี้ไปเช็ค bounding rect ตอนลาก
// event จากปฏิทินจริงออกมา (eventDragStop) ว่าปล่อยเมาส์ทับแผงนี้หรือเปล่า ถ้าใช่ = ลากกลับมา
// เป็นงานวางแผนล่วงหน้า (ดู handleEventDragStop ในไฟล์หลัก)
const UnscheduledPanel = forwardRef(function UnscheduledPanel(
  {
    drafts,
    loading,
    month,
    onMonthChange,
    onAddClick,
    onEditClick,
    onScheduleClick,
    onDeleteClick,
  },
  panelRef,
) {
  const listRef = useRef(null);
  // ✅ เดิมมี 3 ปุ่มเรียงกัน (แก้ไข/ลงตาราง/ลบ) แน่นเกินไปบนการ์ดแคบๆ โดยเฉพาะจอมือถือ —
  // เหลือแค่ "ลงตาราง" (ปุ่มหลักที่ใช้บ่อยสุด) ให้กดตรงๆ ส่วน แก้ไข/ลบ ซ่อนไว้ใน "⋮" แทน
  //
  // ✅ เดิมเมนูใช้ position:absolute ผูกกับการ์ด แต่ .unscheduled-list มี overflow-y:auto
  // (จำกัดความสูงให้เลื่อนดูได้) ทำให้เมนูที่กางลงด้านล่างการ์ดที่อยู่ใกล้ขอบล่างโดนตัดขาด/
  // มองไม่เห็น กดอะไรแทบไม่ได้ — เปลี่ยนเป็น position:fixed คำนวณตำแหน่งจาก bounding rect ของ
  // ปุ่มตอนกด แล้วกางขึ้นด้านบนเสมอ (ไม่ผูกกับ overflow ของ container อีกต่อไป จึงไม่โดนตัด)
  const [menuState, setMenuState] = useState(null); // { id, top, right } (พิกัด viewport)

  useEffect(() => {
    if (!menuState) return undefined;
    const close = () => setMenuState(null);
    document.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menuState]);

  useEffect(() => {
    if (!listRef.current) return undefined;
    // ✅ ต้อง re-init ทุกครั้งที่ drafts เปลี่ยน เพราะ Draggable จับ element ที่มีอยู่ ณ ตอน
    // สร้างเท่านั้น — การ์ดใหม่ที่ถูก re-render เข้ามาทีหลังจะลากไม่ได้ถ้าไม่สร้างใหม่
    const draggable = new Draggable(listRef.current, {
      itemSelector: ".draft-card",
      eventData: (el) => JSON.parse(el.getAttribute("data-event") || "{}"),
    });
    return () => draggable.destroy();
  }, [drafts]);

  const monthLabel = moment(month, "YYYY-MM").locale("th").format("MMMM YYYY");

  return (
    <div className="unscheduled-panel mb-3" ref={panelRef}>
      <div className="unscheduled-panel-header">
        <button
          type="button"
          className="unscheduled-month-nav"
          onClick={() => onMonthChange(moment(month, "YYYY-MM").subtract(1, "month").format("YYYY-MM"))}
          title="เดือนก่อนหน้า"
        >
          <FontAwesomeIcon icon={faChevronLeft} />
        </button>
        <div className="unscheduled-month-label">
          📌 งานวางแผนล่วงหน้า <span>· {monthLabel}</span>
        </div>
        <button
          type="button"
          className="unscheduled-month-nav"
          onClick={() => onMonthChange(moment(month, "YYYY-MM").add(1, "month").format("YYYY-MM"))}
          title="เดือนถัดไป"
        >
          <FontAwesomeIcon icon={faChevronRight} />
        </button>
        <button type="button" className="unscheduled-add-btn" onClick={onAddClick}>
          <FontAwesomeIcon icon={faPlus} /> เพิ่มงาน
        </button>
      </div>

      {loading ? (
        <div className="unscheduled-empty">กำลังโหลด...</div>
      ) : drafts.length === 0 ? (
        <div className="unscheduled-empty">
          ยังไม่มีงานวางแผนไว้ในเดือนนี้ — ลากงานจากปฏิทินมาวางตรงนี้ได้เหมือนกัน
        </div>
      ) : (
        <div className="unscheduled-list" ref={listRef}>
          {drafts.map((d) => {
            const eventData = {
              title: `[${d.title || "งาน"}] ${d.site || ""}`,
              backgroundColor: d.backgroundColor || "#dc2626",
              textColor: d.textColor || "#ffffff",
              extendedProps: { draftId: d._id },
            };
            const isMenuOpen = menuState?.id === d._id;
            return (
              <div
                key={d._id}
                className="draft-card"
                data-event={JSON.stringify(eventData)}
                title="ลากไปวางบนวันที่ต้องการในปฏิทิน"
              >
                <span className="draft-card-grip">
                  <FontAwesomeIcon icon={faGripVertical} />
                </span>
                <div className="draft-card-body">
                  <div className="draft-card-title">
                    {d.title} {d.system ? `· ${d.system}` : ""}
                  </div>
                  <div className="draft-card-sub">
                    {[d.company, d.site].filter(Boolean).join(" · ")}
                  </div>
                  {d.time && <div className="draft-card-time">🔢 ครั้งที่ {d.time}</div>}
                  {d.team && <div className="draft-card-team">👷 {d.team}</div>}
                </div>
                <div className="draft-card-actions">
                  <button
                    type="button"
                    className="draft-card-btn draft-card-btn--schedule-full"
                    onClick={() => onScheduleClick(d)}
                    title="เลือกวันที่ลงตาราง"
                  >
                    <FontAwesomeIcon icon={faCalendarCheck} /> +
                  </button>
                  <div className="draft-card-more">
                    <button
                      type="button"
                      className="draft-card-btn draft-card-btn--more"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isMenuOpen) {
                          setMenuState(null);
                          return;
                        }
                        const rect = e.currentTarget.getBoundingClientRect();
                        setMenuState({ id: d._id, top: rect.top, right: rect.right });
                      }}
                      title="เพิ่มเติม"
                    >
                      <FontAwesomeIcon icon={faEllipsisVertical} />
                    </button>
                    {isMenuOpen && (
                      <div
                        className="draft-card-menu"
                        style={{
                          bottom: `${window.innerHeight - menuState.top + 4}px`,
                          right: `${window.innerWidth - menuState.right}px`,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="draft-card-menu-item"
                          onClick={() => { setMenuState(null); onEditClick(d); }}
                        >
                          <FontAwesomeIcon icon={faPen} /> แก้ไข
                        </button>
                        <button
                          type="button"
                          className="draft-card-menu-item draft-card-menu-item--danger"
                          onClick={() => { setMenuState(null); onDeleteClick(d); }}
                        >
                          <FontAwesomeIcon icon={faTrash} /> ลบ
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default UnscheduledPanel;
