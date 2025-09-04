export const getDeleteEvent = async ({
  setLoading,
  id,
  EventService,
  setEvents,
  fetchEventsFromDB,

  Swal
}) => {
       try {
         Swal.fire({
           title: "คุณแน่ใจหรือไม่?",
           text: "เมื่อทำการลบแล้ว คุณจะไม่สามารถกู้คืนแผนงานนี้ได้!",
           icon: "warning",
           showCancelButton: true,
           confirmButtonColor: "#d33",
           cancelButtonColor: "#3085d6",
           confirmButtonText: "ใช่, ลบแผนงาน",
           cancelButtonText: "ยกเลิก",
         }).then(async (result) => {
           if (result.isConfirmed) {
             setLoading(true); // เริ่มต้นโหลดข้อมูล
   
             try {
               // ส่งคำขอลบแผนงานไปที่เซิร์ฟเวอร์
               await EventService.DeleteEvent(id);
   
               // อัปเดต state โดยกรองแผนงานที่ถูกลบออกจากปฏิทิน
               setEvents((prevEvents) =>
                 prevEvents.filter((event) => event._id !== id)
               );
   
               // โหลดข้อมูลใหม่จากฐานข้อมูล
               await fetchEventsFromDB();
   
               setLoading(false);
   
               // แสดงข้อความแจ้งเตือนว่าการลบสำเร็จ
               Swal.fire({
                 title: "ลบแผนงานสำเร็จ!",
                 text: "แผนงานของคุณถูกลบแล้ว",
                 icon: "success",
                 showConfirmButton: false,
                 timer: 1500,
               });
             } catch (error) {
               console.error("❌ เกิดข้อผิดพลาดในการลบแผนงาน:", error);
               Swal.fire({
                 title: "เกิดข้อผิดพลาด!",
                 text: "ไม่สามารถลบแผนงานได้ กรุณาลองใหม่อีกครั้ง",
                 icon: "error",
               });
             } finally {
               setLoading(false);
             }
           }
         });
       } catch (error) {
         console.error("❌ เกิดข้อผิดพลาดในการลบแผนงาน:", error);
       }
};
