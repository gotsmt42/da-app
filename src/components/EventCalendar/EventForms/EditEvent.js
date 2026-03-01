import Toastify from "toastify-js";
import "toastify-js/src/toastify.css";

export const getEditEvent = async ({
  setEvents,
  fetchEventsFromDB,
  eventInfo,
  setLoading,
  generateWorkPermitPDF,
  handleDeleteEvent,
  EventService,
  CustomerService,
  AuthService,
  Swal,
  TomSelect,
  moment,
  calendarRef,
  userData
}) => {


  const inputBackgroundColor = document.createElement("input");
  inputBackgroundColor.type = "color";
  inputBackgroundColor.value = eventInfo.event.backgroundColor;

  const inputTextColor = document.createElement("input");
  inputTextColor.type = "color";
  inputTextColor.value = eventInfo.event.textColor;

  const eventId = eventInfo.event.id;
  const docNum = eventInfo.event.docNum;
  const evendocNo = eventInfo.event.extendedProps?.docNo || "";
  const eventCompany = eventInfo.event.extendedProps?.company || "";
  const eventSite = eventInfo.event.extendedProps?.site || "";

  const eventTitle = eventInfo.event.title;
  const eventSystem = eventInfo.event.extendedProps?.system || "";
  const eventTeam = eventInfo.event.extendedProps?.team || "";
  const eventTime = eventInfo.event.extendedProps?.time || "";

  const eventFontSize = eventInfo.event.extendedProps.fontSize;

  const eventStart = moment(eventInfo.event.start);
  const eventEnd = moment(eventInfo.event.end);
  const eventAllDay = eventInfo.event.allDay;

  let eventStatus = eventInfo.event.extendedProps?.status || "กำลังรอยืนยัน"; // ค่าเริ่มต้น

  const eventSubject = eventInfo.event.extendedProps?.subject || "";
  const eventDescription = eventInfo.event.extendedProps?.description || "";

  const eventStartTime = eventInfo.event.extendedProps?.startTime || "";
  const eventEndTime = eventInfo.event.extendedProps?.endTime || "";

  const formattedEnd = eventAllDay
    ? moment(eventEnd).subtract(1, "days").format("YYYY-MM-DD")
    : moment(eventEnd).format("YYYY-MM-DDTHH:mm");

  const res = await CustomerService.getCustomers();
  const employees = await AuthService.getAllUserData();

  const userId = eventInfo.event.extendedProps?.userId;
  const employeeList = employees?.allUser || [];
  const lastModifiedBy = eventInfo.event.extendedProps?.lastModifiedBy; // คนแก้ไขล่าสุด
  // หาคนที่สร้าง event

  // หาคนที่แก้ไขล่าสุด
  // const modifier = employeeList.find(
  //   (emp) => emp?._id?.toString() === lastModifiedBy?.toString()
  // );

// หาคนที่สร้าง event
const eventOwner = employeeList.find(
  (emp) => emp?._id?.toString() === userId?.toString()
);

// ✅ แสดงเฉพาะชื่อเจ้าของเดิม ไม่ว่าใครจะ update
let footerName = "";
if (eventOwner) {
  footerName =
    eventOwner.username || `${eventOwner.fname} ${eventOwner.lname}`;
}


  // ถ้าไม่มี modifier ที่เข้าเงื่อนไข → fallback เป็นเจ้าของเดิม
  if (!footerName && eventOwner) {
    footerName =
      eventOwner.username || `${eventOwner.fname} ${eventOwner.lname}`;
  }

  // 🔧 โค้ด htmlEdit พร้อม label ทุกหัวข้อเพื่อความชัดเจน
  const htmlEdit = `

          <!-- สถานะงาน (อยู่แยกด้านบน แถวเดียว) -->
          <!-- ✅ ไม่ใช้ label ครอบ select -->
          <div style="margin-bottom: 12px; width: 100%;">
            <label
              for="editStatus"
              style="display: block; margin-bottom: 4px; font-weight: bold;"
            >
              🛠️ สถานะงาน :
            </label>

            <!-- ✅ คลิกได้เฉพาะตรง select -->
            <select
              id="editStatus"
              class="swal2-select"
              style="
                width: 100%;
                height: 40px;
                text-align-last: center;
                appearance: none;
              "
            >
              ${[
                // "ยกเลิก",
                "กำลังรอยืนยัน",
                "ยืนยันแล้ว",
                "กำลังดำเนินการ",
                // "เสนอราคาแก้ไขแล้ว",
                // "วางบิลแล้วรอเก็บเงิน",
                "ดำเนินการเสร็จสิ้น",
              ]
                .map(
                  (status) =>
                    `<option value="${status}" ${
                      eventStatus === status ? "selected" : ""
                    }>${status}</option>`
                )
                .join("")}
            </select>
          </div>

      <!-- Container กึ่งกลาง -->
      <div style="display: flex; justify-content: center;">
        <!-- Grid ฟอร์ม -->
        <div class="swal-form-grid" style="
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          margin-top: 12px;
          font-family: 'Segoe UI', sans-serif;
        ">

          <!-- ชื่อบริษัท -->
          <div style="flex: 1 1 calc(33.333% - 16px); min-width: 220px;">
            <label for="editCompany" style="font-weight: bold; margin-bottom: 6px; display: block;">ชื่อบริษัท/นิติบุคคล:</label>
            <select id="editCompany" class="swal2-select" style="width: 100%; padding: 10px 14px; font-size: 15px; border: 1px solid #ccc; border-radius: 8px; background-color: #f9f9f9;">
              <option disabled selected>${eventCompany}</option>
              ${res.userCustomers
                .map(
                  (c) =>
                    `<option value="${c.cCompany}" ${
                      eventCompany === c.cCompany ? "selected" : ""
                    }>${c.cCompany}</option>`
                )
                .join("")}
            </select>
          </div>

          <!-- ชื่อโครงการ -->
          <div style="flex: 1 1 calc(33.333% - 16px); min-width: 220px;">
<label for="editSite" style="font-weight: bold; margin-bottom: 6px; display: block;">
  <span style="color: red;">*</span> ชื่อโครงการ:
</label>            <select id="editSite" class="swal2-select" style="width: 100%; padding: 10px 14px; font-size: 15px; border: 1px solid #ccc; border-radius: 8px; background-color: #f9f9f9;">
              <option disabled selected>${eventSite || ""}</option>
              ${res.userCustomers
                .map(
                  (c) =>
                    `<option value="${c.cSite}" ${
                      eventSite === c.cSite ? "selected" : ""
                    }>${c.cSite}</option>`
                )
                .join("")}
            </select>
          </div>

    <!-- ประเภทงาน -->
    <div style="flex: 1 1 calc(33.333% - 16px); min-width: 220px;">
<label for="editTitle" style="font-weight: bold; margin-bottom: 6px; display: block;">
  <span style="color: red;">*</span> ประเภทงาน:
</label>
      <select id="editTitle" class="swal2-select" style="width: 100%; padding: 10px 14px; font-size: 15px; border: 1px solid #ccc; border-radius: 8px; background-color: #f9f9f9;">
        <option disabled selected>${eventTitle || ""}</option>
        ${[
          "LOCAL",
          "PO",
          "PM",
          "Service",
          "Training",
          "Inspection",
          "Test & Commissioning",
          "สำรวจหน้างาน",
          "ตรวจเช็คปัญหา",
          "แก้ไขปัญหา",
          "สแตนบาย",
          "เปลี่ยนอุปกรณ์",
          "ติดตั้งอุปกรณ์",
        ]
          .map(
            (title) =>
              `<option value="${title}" ${
                eventTitle === title ? "selected" : ""
              }>${title}</option>`
          )
          .join("")}
      </select>
    </div>

    <!-- ระบบงาน -->
    <div style="flex: 1 1 calc(33.333% - 16px); min-width: 220px;">
<label for="editSystem" style="font-weight: bold; margin-bottom: 6px; display: block;">
  <span style="color: red;">*</span> ระบบงาน:
</label>      <select id="editSystem" class="swal2-select" style="width: 100%; padding: 10px 14px; font-size: 15px; border: 1px solid #ccc; border-radius: 8px; background-color: #f9f9f9;">
        <option disabled selected>${eventSystem || ""}</option>
        ${["Office", "Fire Alarm", "CCTV", "Access Control", "Networks"]
          .map(
            (sys) =>
              `<option value="${sys}" ${
                eventSystem === sys ? "selected" : ""
              }>${sys}</option>`
          )
          .join("")}
      </select>
    </div>

    <!-- ครั้งที่ -->
    <div style="flex: 1 1 calc(33.333% - 16px); min-width: 220px;">
      <label for="editTime" style="font-weight: bold; margin-bottom: 6px; display: block;">ครั้งที่:</label>
      <select id="editTime" class="swal2-select" style="width: 100%; padding: 10px 14px; font-size: 15px; border: 1px solid #ccc; border-radius: 8px; background-color: #f9f9f9;">
        <option disabled selected>${eventTime}</option>
        ${["1", "2", "3", "4"]
          .map(
            (t) =>
              `<option value="${t}" ${
                eventTime === t ? "selected" : ""
              }>${t}</option>`
          )
          .join("")}
      </select>
    </div>

    <!-- ทีม -->
    <div style="flex: 1 1 calc(33.333% - 16px); min-width: 220px;">
      <label for="editTeam" style="font-weight: bold; margin-bottom: 6px; display: block;">ทีม:</label>
      <select id="editTeam" class="swal2-select" style="width: 100%; padding: 10px 14px; font-size: 15px; border: 1px solid #ccc; border-radius: 8px; background-color: #f9f9f9;">
        <option disabled selected>${eventTeam || ""}</option>
        ${employeeList
          .map(
            (e) =>
              `<option value="${e.fname}" ${
                eventTeam === e.fname ? "selected" : ""
              }>${e.fname}</option>`
          )
          .join("")}
      </select>
    </div>

  </div>
</div>



<div style="display: flex; justify-content: center;">
  <div class="swal-form-grid" style="
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: flex-start;
    margin-top: 12px;
    font-family: 'Segoe UI', sans-serif;
    max-width: 1000px; /* ✅ ป้องกันไม่ให้กว้างเกิน modal */
  ">

    <!-- สีพื้นหลัง -->
    <div style=" min-width: 100px;">
      <label style="font-weight: bold; margin-bottom: 4px; display: block;">สีพื้นหลัง :</label>
      <div id="backgroundColorPickerContainer"></div>
    </div>

    <!-- สีข้อความ -->
    <div style="flex: 1; min-width: 100px;">
      <label style="font-weight: bold; margin-bottom: 4px; display: block;">สีข้อความ :</label>
      <div id="textColorPickerContainer"></div>
    </div>

    <!-- วันที่เริ่ม -->
    <div style="flex: 1; min-width: 100px;">
      <label for="editStart" style="font-weight: bold; margin-bottom: 4px; display: block;">วันที่เริ่ม :</label>
      <input
        id="editStart"
        type="date"
        style="width: 100%; padding: 6px 10px; border-radius: 6px; border: 1px solid #ccc;"
        value="${eventStart.format("YYYY-MM-DD")}"
      />
    </div>

    <!-- วันที่สิ้นสุด -->
    <div style="flex: 1; min-width: 100px;">
      <label for="editEnd" style="font-weight: bold; margin-bottom: 4px; display: block;">วันที่สิ้นสุด :</label>
      <input
        id="editEnd"
        type="date"
        style="width: 100%; padding: 6px 10px; border-radius: 6px; border: 1px solid #ccc;"
        value="${formattedEnd}"
      />
    </div>






  </div>
</div>


<div style="display: flex; justify-content: center;">
  <div class="swal-form-grid" style="
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: flex-start;
    margin-top: 12px;
    font-family: 'Segoe UI', sans-serif;
    max-width: 1000px; /* ✅ ป้องกันไม่ให้กว้างเกิน modal */
  ">


<!-- เวลาเริ่ม -->
<div style="flex: 1; min-width: 100px;">
  <label for="editStartTime" style="font-weight: bold; margin-bottom: 4px; display: block;">เวลาเริ่ม :</label>
  <input
    id="editStartTime"
    type="text"
    placeholder="เช่น 08:30"

    style="width:80%; padding: 6px 10px; border-radius: 6px; border: 1px solid #ccc;"
    value="${eventStartTime || ""}"
  />
</div>

<!-- เวลาสิ้นสุด -->
<div style="flex: 1; min-width: 100px;">
  <label for="editEndTime" style="font-weight: bold; margin-bottom: 4px; display: block;">เวลาสิ้นสุด :</label>
  <input
    id="editEndTime"
    type="text"
    placeholder="เช่น 17:45"

    style="width: 80%; padding: 6px 10px; border-radius: 6px; border: 1px solid #ccc;"
    value="${eventEndTime || ""}"
  />
</div>



  </div>
</div>
<br><br>


    <!-- เลขที่อ้างอิงเอกสาร -->
        <div style="margin-top: 12px; position: relative;">
        <label for="editDescription" style="font-weight: bold; display: block; margin-bottom: 6px;">
            * เลขที่อ้างอิงเอกสาร (doc No.) :
        </label>

            <input id="editdocNo" type="" style="width: 80%; height: 35px" class="swal2-input" value="${evendocNo}" />
        </div>      
        <br>
        
        
    <!-- ชื่อเรื่อง -->
        <div style="margin-top: 12px; position: relative;">
        <label for="editSubject" style="font-weight: bold; display: block; margin-bottom: 6px;">
            * ชื่อเรื่อง (Subject.) :
        </label>

            <input id="editSubject" type="" style="width: 80%; height: 35px" class="swal2-input" value="${eventSubject}" />
        </div>      
        <br>


    <!-- รายละเอียดงานสำหรับออกใบแจ้งเข้างาน -->
    <div style="margin-top: 12px; position: relative;">
    <label for="editDescription" style="font-weight: bold; display: block; margin-bottom: 6px;">
        * รายละเอียดงาน (Description) :
    </label>

    <textarea
        id="editDescription"
        rows="10"
        
    
        placeholder="กรอกรายละเอียดงานที่ต้องการแสดงในเอกสาร PDF"

        style="
        width: 100%;
        padding: 14px 16px;
        font-size: 15px;
        border: 1px solid #ccc;
        border-radius: 8px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.08);
        transition: border-color 0.3s, box-shadow 0.3s;
        resize: vertical;
        font-family: 'Segoe UI', sans-serif;
        "
    ></textarea>



  <!-- ตัวนับจำนวนตัวอักษร -->
<div id="charCount" style="text-align: right; font-size: 12px; color: #666; margin-top: 4px;">
  จำนวนตัวอักษร: 0
</div>





</div>


  `;

  Swal.fire({
    title: `<h4>[ ${eventTitle} ] ${eventSystem}  ${eventSite} ${
      eventTeam ? ` (ทีม ${eventTeam})` : ""
    }</h4>`,
    html: htmlEdit,

    showConfirmButton: false, // ❌ ซ่อนปุ่มเดิม
    showCancelButton: false,

    showCloseButton: true,
    customClass: "swal-wide",
    footer: `
  <div style="margin-top: 20px; display: flex; flex-direction: column; align-items: center; gap: 12px;">
      <div style="width: 100%; overflow: hidden; white-space: nowrap;">
        <marquee behavior="scroll" direction="left" scrollamount="5" style="color:#0064de; font-weight:bold;">
          👤 เพิ่มข้อมูลโดย: ${footerName}
        </marquee>
      </div>
      <div id="custom-footer-buttons" style="display: flex; flex-wrap: wrap; justify-content: center; gap: 12px;">
        <button id="btnConfirm" class="swal2-confirm swal2-styled" style="background-color: #0ECC00;">
          ✅ บันทึกการเปลี่ยนแปลง
        </button>
        <button id="btnGeneratePDF" class="swal2-confirm swal2-styled" style="background-color: #0064de;">
          📝 ออกใบแจ้งเข้างาน
        </button>
        <button id="btnCancel" class="swal2-cancel swal2-styled" style="background-color: #999;">
          🔙 ปิดหน้าต่าง
        </button>
      </div>
    </div>
`,
    showDenyButton: true,
    denyButtonText: "❌ ลบแผนงานนี้",

    didOpen: () => {
      const descriptionInput = document.getElementById("editDescription");
      const charCountDisplay = document.getElementById("charCount");

      const clearBtn = document.getElementById("clearDescriptionBtn");

      const imageInput = document.getElementById("editImage");
      const previewContainer = document.getElementById("imagePreviewContainer");

      if (imageInput) {
        imageInput.addEventListener("change", () => {
          const file = imageInput.files[0];
          if (!file) return;

          const reader = new FileReader();
          reader.onload = (e) => {
            const imgUrl = e.target.result;

            previewContainer.innerHTML = `
        <img src="${imgUrl}" alt="Preview" style="max-width: 100%; max-height: 200px; border-radius: 8px; cursor: pointer;" id="previewImage" />
      `;

            // ✅ เปิดภาพเต็มเมื่อคลิก
            document
              .getElementById("previewImage")
              ?.addEventListener("click", () => {
                Swal.fire({
                  title: "ดูรูปภาพ",
                  imageUrl: imgUrl,
                  imageAlt: "Uploaded Image",
                  showCloseButton: true,
                  width: "auto",
                });
              });
          };
          reader.readAsDataURL(file);
        });
      }

      if (descriptionInput) {
        descriptionInput.value = eventDescription || "";
      }

      const statusColorMap = {
        กำลังรอยืนยัน: "#888888",
        ยืนยันแล้ว: "#0c49ac",
        กำลังดำเนินการ: "#a1b50b",
        ดำเนินการเสร็จสิ้น: "#18b007",
      };

      const iconMap = {
        กำลังรอยืนยัน: "fa-hourglass-half",
        ยืนยันแล้ว: "fa-check",
        กำลังดำเนินการ: "fa-clock-rotate-left",
        ดำเนินการเสร็จสิ้น: "fa-check-double",
      };
      const initTomSelect = (id, create = true, placeholder = "") => {
        return new TomSelect(id, {
          create,
          persist: false,
          placeholder,
          maxItems: null, // ✅ ไม่จำกัดจำนวน เพื่อให้ input ไม่ถูกซ่อน
          closeAfterSelect: false,
          dropdownInput: true,
          selectOnTab: true,
          plugins: ["remove_button"],
          onItemAdd: function () {
            // ✅ ลบรายการเก่าเมื่อเพิ่มใหม่ เพื่อให้มีแค่ 1 ค่าเสมอ
            if (this.items.length > 1) {
              this.removeItem(this.items[0], true);
            }
          },
        });
      };

      // 🔄 สร้าง TomSelect ทั้งหมด
      [
        ["#editCompany", "เลือกหรือพิมพ์ชื่อบริษัท"],
        ["#editSite", "เลือกหรือพิมพ์ชื่อโครงการ"],
        ["#editTitle", "เลือกหรือพิมพ์ชื่อหัวข้อ"],
        ["#editSystem", "เลือกหรือพิมพ์ชื่อระบบ"],
        ["#editTime", "เลือกหรือพิมพ์ครั้งที่"],
        ["#editTeam", "เลือกหรือพิมพ์ชื่อทีม"],
      ].forEach(([id, placeholder]) => initTomSelect(id, true, placeholder));

      const statusSelect = new TomSelect("#editStatus", {
        create: false,
        placeholder: "เลือกสถานะงาน",
        render: {
          option: (data, escape) => {
            const color = statusColorMap[data.value] || "#ccc";
            const icon = iconMap[data.value] || "fa-circle";
            return `
            <div style="display: flex; align-items: center; gap: 8px;">
              <i class="fas ${icon}" style="color: ${color}; width: 18px;"></i>
              <span>${escape(data.text)}</span>
            </div>`;
          },
          item: (data, escape) => `<div>${escape(data.text)}</div>`,
        },

        onChange: (value) => {
          const control = statusSelect.control_input.parentElement;
          control.style.backgroundColor = statusColorMap[value] || "#ccc";
          control.style.color = value === "กำลังดำเนินการ" ? "#000" : "#fff";
          control.style.borderColor = "#999";

          // ✅ อัปเดต eventInfo.event ทันที
          if (eventInfo?.event) {
            const calendarApi = calendarRef.current?.getApi();
            const oldEvent = eventInfo.event;

            const newEventData = {
              id: oldEvent.id,
              title: oldEvent.title,
              start: oldEvent.start,
              end: oldEvent.end,
              backgroundColor: inputBackgroundColor.value, // ✅ สีใหม่
              textColor: inputTextColor.value,
              fontSize: oldEvent.extendedProps.fontSize,
              status: oldEvent.extendedProps.status,
              manualStatus: oldEvent.extendedProps.manualStatus,
              description: oldEvent.extendedProps.description,
              extendedProps: {
                ...oldEvent.extendedProps,
              },
            };

            oldEvent.remove();
            calendarApi.addEvent(newEventData);
          }

          // ✅ อัปเดตใน state ถ้าใช้ React หรือ Vue
          //   setEvents((prevEvents) =>
          //     prevEvents.map((event) =>
          //       event.id === eventInfo.event.id
          //         ? { ...event, status: value }
          //         : event
          //     )
          //   );
        },
      });
      const initialColor = statusColorMap[statusSelect.getValue()] || "#ccc";
      const control = statusSelect.control_input.parentElement;
      control.style.backgroundColor = initialColor;
      control.style.color =
        statusSelect.getValue() === "กำลังดำเนินการ" ? "#000" : "#fff";

      [inputBackgroundColor, inputTextColor].forEach((el) => {
        Object.assign(el.style, {
          width: "150px",
          height: "35px",
          border: "4px solid #ccc",
          cursor: "pointer",
        });
      });

      document
        .getElementById("backgroundColorPickerContainer")
        .appendChild(inputBackgroundColor);
      document
        .getElementById("textColorPickerContainer")
        .appendChild(inputTextColor);

      const updateCharCount = () => {
        const val = descriptionInput?.value || "";
        if (charCountDisplay) {
          charCountDisplay.innerText = `จำนวนตัวอักษร: ${val.length}`;
        }
      };

      if (descriptionInput) {
        descriptionInput.addEventListener("input", updateCharCount);
        updateCharCount(); // เรียกตอนเปิด popup
      }

      if (clearBtn && descriptionInput) {
        clearBtn.addEventListener("click", () => {
          descriptionInput.value = "";
          updateCharCount();
        });
      }
    },

    didRender: () => {
      const getVal = (id) => document.getElementById(id)?.value || "";

      document.getElementById("btnConfirm")?.addEventListener("click", () => {
        Swal.clickConfirm(); // ✅ ทำให้ result.isConfirmed === true
      });

      document.getElementById("btnDeny")?.addEventListener("click", () => {
        handleDeleteEvent(eventId);
        Swal.close();
      });

      document.getElementById("btnCancel")?.addEventListener("click", () => {
        Swal.close();
      });

      const endInput = getVal("editEnd");
      const end = endInput
        ? eventAllDay
          ? moment(endInput).add(1, "days").toISOString()
          : moment(endInput).toISOString()
        : eventEnd.toISOString();
      document
        .getElementById("btnGeneratePDF")
        ?.addEventListener("click", () => {
          const toast = Toastify({
            text: `
              <div style="text-align:center">
                <div style="margin-bottom:8px;">ต้องการบันทึกข้อมูลก่อนออกใบแจ้งเข้างานหรือไม่?</div>
                <button id="toast-confirm" style="margin-right:10px; padding:4px 12px; background:#fff; border:none; border-radius:4px; cursor:pointer;">ตกลง</button>
                <button id="toast-cancel" style="padding:4px 12px; background:#fff; border:none; border-radius:4px; cursor:pointer;">ยกเลิก</button>
              </div>
            `,
            duration: 3000,
            gravity: "top", // ต้องใช้ "top" เพื่อให้เราดัดแปลงตำแหน่งได้
            position: "center",
            backgroundColor: "#0064de",
            escapeMarkup: false,
          });

          toast.showToast();

          setTimeout(() => {
            const confirmBtn = document.getElementById("toast-confirm");
            const cancelBtn = document.getElementById("toast-cancel");

            if (confirmBtn) {
              confirmBtn.addEventListener("click", async () => {
                toast.hideToast(); // ✅ ปิด Toastify

                const subject = getVal("editSubject");
                if (!subject) {
                  Toastify({
                    text: "กรุณากรอกชื่อเรื่อง",
                    duration: 3000,
                    backgroundColor: "#f44336",
                    gravity: "top",
                    position: "center",
                  }).showToast();
                  return;
                }

                const updatedEvent = {
                  id: eventId,
                  docNo: getVal("editdocNo"),
                  company: getVal("editCompany"),
                  site: getVal("editSite"),
                  title: getVal("editTitle"),
                  system: getVal("editSystem"),
                  time: getVal("editTime"),
                  team: getVal("editTeam"),
                  textColor: inputTextColor.value,
                  backgroundColor: inputBackgroundColor.value,
                  fontSize: eventFontSize,
                  status: getVal("editStatus"),
                  start: moment(getVal("editStart")).toISOString(),
                  end,
                  manualStatus: true,
                  subject: getVal("editSubject"),
                  description: getVal("editDescription"),

                  startTime: getVal("editStartTime"),
                  endTime: getVal("editEndTime"),

              
                };

                try {
                  await EventService.UpdateEvent(eventId, updatedEvent);
                  await fetchEventsFromDB();

                  Toastify({
                    text: "✅ บันทึกข้อมูลสำเร็จ กำลังสร้าง PDF...",
                    duration: 3000,
                    backgroundColor: "#0ECC00",
                    gravity: "top",
                    position: "center",
                  }).showToast();

                  // สมมติว่า generateWorkPermitPDF คืน URL ของ PDF
                  const pdfUrl = await generateWorkPermitPDF(
                    eventInfo.event,
                    updatedEvent.docNo,
                    updatedEvent.subject,
                    updatedEvent.description,
                    updatedEvent.startTime,
                    updatedEvent.endTime,
                    updatedEvent.time,
                    userData
                  );

                  // เปิด PDF ในแท็บใหม่ทันที
                  window.open(pdfUrl, "_blank");
                } catch (error) {
                  Toastify({
                    text: "❌ เกิดข้อผิดพลาดในการบันทึก",
                    duration: 3000,
                    backgroundColor: "#f44336",
                    gravity: "top",
                    position: "center",
                  }).showToast();
                }
              });
            }

            if (cancelBtn) {
              cancelBtn.addEventListener("click", () => {
                toast.hideToast(); // ✅ ปิด Toastify
              });
            }
          }, 100);
        });

      document
        .getElementById("btnViewSchedule")
        ?.addEventListener("click", () => {
          window.location.href = `/operation/${eventId}`;
        });
    },

    preConfirm: () => {
      const getVal = (id) => document.getElementById(id)?.value || "";
      const title = getVal("editTitle");
      const site = getVal("editSite");
      const system = getVal("editSystem");

      const startTime = getVal("editStartTime") || "";
      const endTime = getVal("editEndTime") || "";

      if (!title) Swal.showValidationMessage("กรุณาระบุชื่อประเภทงาน");
      if (!site) Swal.showValidationMessage("กรุณาระบุชื่อโครงการ");
      if (!system) Swal.showValidationMessage("กรุณาระบุชื่อระบบงาน");

      const endInput = getVal("editEnd");
      const end = endInput
        ? eventAllDay
          ? moment(endInput).add(1, "days").toISOString()
          : moment(endInput).toISOString()
        : eventEnd.toISOString();

      const imageFile = document.getElementById("editImage")?.files[0] || null;

      return {
        id: eventId,
        docNo: getVal("editdocNo"),
        company: getVal("editCompany"),
        site: getVal("editSite"),
        title,
        system: getVal("editSystem"),
        time: getVal("editTime"),
        team: getVal("editTeam"),
        textColor: inputTextColor.value,
        backgroundColor: inputBackgroundColor.value,
        fontSize: eventFontSize,
        status: getVal("editStatus"),
        start: moment(getVal("editStart")).toISOString(),
        end,
        manualStatus: true,

        subject: getVal("editSubject"),
        description: getVal("editDescription"),

        startTime,
        endTime,

        imageFile,
      };
    },
  }).then(async (result) => {
    console.log("🔥 Swal result:", result);

    if (result.isConfirmed) {
      setLoading(true);

      const {
        id,
        docNo,
        company,
        site,
        title,
        system,
        time,
        team,
        textColor,
        backgroundColor,
        fontSize,
        status,
        start,
        end,
        manualStatus,
        subject,
        description,
        startTime,
        endTime,
        imageFile,
      } = result.value;

      const updatedEvent = {
        id,
        docNo,
        company,
        site,
        title,
        system,
        time,
        team,
        textColor,
        backgroundColor,
        fontSize,
        status,
        start,
        end,
        manualStatus,
        subject,
        description,
        startTime,
        endTime,
      };

      // ✅ ตรวจสอบและเพิ่ม Customer ใหม่ถ้ายังไม่มี
      const existingCustomer = res.userCustomers.find(
        (c) => c.cCompany === company && c.cSite === site
      );

      if (!existingCustomer) {
        await CustomerService.AddCustomer({
          cCompany: company ?? "",
          cSite: site ?? "",
        });
      }

      // ✅ อัพเดทรูปภาพถ้ามี
      if (imageFile) {
        await EventService.UpdateImageEvent(id, updatedEvent, imageFile);
      }

      // ✅ อัพเดท state
      setEvents((prevEvents) =>
        prevEvents.map((event) => (event._id === id ? updatedEvent : event))
      );

      try {
        // ✅ ส่งข้อมูลแก้ไขไปยัง API
        await EventService.UpdateEvent(id, updatedEvent);
        await fetchEventsFromDB();

        setLoading(false);

        Swal.fire({
          title: "บันทึกการเปลี่ยนแปลงสำเร็จ",
          icon: "success",
          showConfirmButton: false,
          timer: 1000,
        });
      } catch (error) {
        setLoading(false);
        Swal.fire({
          title: "เกิดข้อผิดพลาดในการบันทึก",
          text: error.message || "โปรดลองอีกครั้ง",
          icon: "error",
          showConfirmButton: true,
        });
      }
    } else if (result.isDenied) {
      handleDeleteEvent(eventId);
    }
  });
};
