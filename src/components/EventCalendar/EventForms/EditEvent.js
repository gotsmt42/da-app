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
}) => {
  const inputBackgroundColor = document.createElement("input");
  inputBackgroundColor.type = "color";
  inputBackgroundColor.value = eventInfo.event.backgroundColor;

  const inputTextColor = document.createElement("input");
  inputTextColor.type = "color";
  inputTextColor.value = eventInfo.event.textColor;

  const eventId = eventInfo.event.id;
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

  const eventDescription = eventInfo.event.extendedProps?.description ?? "";

  const formattedEnd = eventAllDay
    ? moment(eventEnd).subtract(1, "days").format("YYYY-MM-DD")
    : moment(eventEnd).format("YYYY-MM-DDTHH:mm");

  const res = await CustomerService.getCustomers();
  const employees = await AuthService.getAllUserData();

  const employeeList = employees?.allUser || [];

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
      <label for="editSite" style="font-weight: bold; margin-bottom: 6px; display: block;">ชื่อโครงการ:</label>
      <select id="editSite" class="swal2-select" style="width: 100%; padding: 10px 14px; font-size: 15px; border: 1px solid #ccc; border-radius: 8px; background-color: #f9f9f9;">
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
      <label for="editTitle" style="font-weight: bold; margin-bottom: 6px; display: block;">ประเภทงาน:</label>
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
      <label for="editSystem" style="font-weight: bold; margin-bottom: 6px; display: block;">ระบบงาน:</label>
      <select id="editSystem" class="swal2-select" style="width: 100%; padding: 10px 14px; font-size: 15px; border: 1px solid #ccc; border-radius: 8px; background-color: #f9f9f9;">
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
      <label for="editStart" style="font-weight: bold; margin-bottom: 4px; display: block;">เริ่มต้น :</label>
      <input
        id="editStart"
        type="date"
        style="width: 100%; padding: 6px 10px; border-radius: 6px; border: 1px solid #ccc;"
        value="${eventStart.format("YYYY-MM-DD")}"
      />
    </div>

    <!-- วันที่สิ้นสุด -->
    <div style="flex: 1; min-width: 100px;">
      <label for="editEnd" style="font-weight: bold; margin-bottom: 4px; display: block;">สิ้นสุด :</label>
      <input
        id="editEnd"
        type="date"
        style="width: 100%; padding: 6px 10px; border-radius: 6px; border: 1px solid #ccc;"
        value="${formattedEnd}"
      />
    </div>

  </div>
</div>
<br>


      <!-- เลขที่อ้างอิงเอกสาร -->
<div style="margin-top: 12px; position: relative;">
  <label for="editDescription" style="font-weight: bold; display: block; margin-bottom: 6px;">
    ** เลขที่อ้างอิงเอกสาร (doc No.) :
  </label>


          <input id="editdocNo" type="" style="width: 80%; height: 35px" class="swal2-input" value="${evendocNo}" />



</div>
<br>
<!-- รายละเอียดงานสำหรับออกใบแจ้งเข้างาน -->
<div style="margin-top: 12px; position: relative;">
  <label for="editDescription" style="font-weight: bold; display: block; margin-bottom: 6px;">
    ** รายละเอียดงานสำหรับออกใบแจ้งเข้างาน (Work Permit) :
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
  > ${eventDescription || ""}</textarea>



  <!-- ตัวนับจำนวนตัวอักษร -->
<div id="charCount" style="text-align: right; font-size: 12px; color: #666; margin-top: 4px;">
  จำนวนตัวอักษร: 0
</div>

</div>


  `;

  Swal.fire({
    title: `<h4>[ ${eventTitle} ] ${eventSystem} ${eventSite}${
      eventTeam ? ` (ทีม ${eventTeam})` : ""
    }</h4>`,
    html: htmlEdit,

    showConfirmButton: false, // ❌ ซ่อนปุ่มเดิม
    showCancelButton: false,
    showDenyButton: true, // ใช้ปุ่ม Deny เป็นปุ่มลบ
    denyButtonText: "❌ ลบแผนงานนี้",
    showCloseButton: true,
    customClass: "swal-wide",
    footer: `
    <div id="custom-footer-buttons" style="margin-top: 20px; display: flex; flex-wrap: wrap; justify-content: center; gap: 12px;">
      <button id="btnConfirm" class="swal2-confirm swal2-styled" style="background-color: #0ECC00;">
        ✅ บันทึกการเปลี่ยนแปลง
      </button>
   
      <button id="btnCancel" class="swal2-cancel swal2-styled" style="background-color: #999;">
        🔙 ปิดหน้าต่าง
      </button>
      <button id="btnGeneratePDF" class="swal2-confirm swal2-styled" style="background-color: #0064de;">
        📝 ออกใบแจ้งเข้างาน
      </button>
      
    </div>
  `,

    didOpen: () => {
      const descriptionInput = document.getElementById("editDescription");
      const charCountDisplay = document.getElementById("charCount");

      const clearBtn = document.getElementById("clearDescriptionBtn");

      const textarea = document.getElementById("editDescription");
      if (textarea) {
        textarea.value = eventDescription || "";
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
          maxOptions: 7,
          placeholder,
          sortField: { field: "text", direction: "asc" },
        });
      };
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

      // 🔄 สร้าง TomSelect ทั้งหมด
      [
        ["#editCompany", "เลือกหรือพิมพ์ชื่อบริษัท"],
        ["#editSite", "เลือกหรือพิมพ์ชื่อโครงการ"],
        ["#editTitle", "เลือกหรือพิมพ์ชื่อหัวข้อ"],
        ["#editSystem", "เลือกหรือพิมพ์ชื่อระบบ"],
        ["#editTime", "เลือกหรือพิมพ์ครั้งที่"],
        ["#editTeam", "เลือกหรือพิมพ์ชื่อทีม"],
      ].forEach(([id, placeholder]) => initTomSelect(id, true, placeholder));

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
      const replaceEventWithUpdatedColors = (event, newColors = {}) => {
        const calendarApi = calendarRef.current?.getApi();
        if (!calendarApi || !event) return;

        const newEventData = {
          id: event.id,
          title: event.title,
          start: event.start,
          end: event.end,
          backgroundColor: newColors.backgroundColor || event.backgroundColor,
          textColor: newColors.textColor || event.textColor,
          fontSize: event.extendedProps.fontSize,
          status: event.extendedProps.status,
          manualStatus: event.extendedProps.manualStatus,
          description: event.extendedProps.description,
          extendedProps: {
            ...event.extendedProps,
            status: event.extendedProps.status,
          },
        };

        event.remove();
        calendarApi.addEvent(newEventData);
      };

      const getVal = (id) => document.getElementById(id)?.value || "";

      document
        .getElementById("btnConfirm")
        ?.addEventListener("click", async () => {
          const title = getVal("editTitle");
          if (!title) {
            Swal.showValidationMessage("กรุณากรอกชื่อแผนงาน");
            return;
          }

          const endInput = getVal("editEnd");
          const end = endInput
            ? eventAllDay
              ? moment(endInput).add(1, "days").toISOString()
              : moment(endInput).toISOString()
            : eventEnd.toISOString();

          const description = getVal("editDescription");

          const updatedEvent = {
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
            description,
          };

          // ✅ อัปเดต event และปิด Swal
          await EventService.UpdateEvent(eventId, updatedEvent);
          await fetchEventsFromDB();
          Swal.close();

          // ✅ อัปเดตสี icon ทันทีหลังบันทึก
          replaceEventWithUpdatedColors(eventInfo.event, {
            backgroundColor: inputBackgroundColor.value,
            textColor: inputTextColor.value,
          });

          Swal.fire({
            title: "บันทึกการเปลี่ยนแปลงสำเร็จ",
            icon: "success",
            showConfirmButton: false,
            timer: 1000,
          });
        });

      document.getElementById("btnDeny")?.addEventListener("click", () => {
        handleDeleteEvent(eventId);
        Swal.close();
      });

      document.getElementById("btnCancel")?.addEventListener("click", () => {
        Swal.close();
      });

      document
        .getElementById("btnGeneratePDF")
        ?.addEventListener("click", () => {
          const description = getVal("editDescription");
          generateWorkPermitPDF(eventInfo.event, description);
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
      const description = getVal("editDescription");
      if (!title) Swal.showValidationMessage("กรุณากรอกชื่อแผนงาน");

      const endInput = getVal("editEnd");
      const end = endInput
        ? eventAllDay
          ? moment(endInput).add(1, "days").toISOString()
          : moment(endInput).toISOString()
        : eventEnd.toISOString();

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
        description,
      };
    },
  }).then(async (result) => {
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
        description,
      } = result.value;

      const updatedEvent = {
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
        manualStatus, // เพิ่ม field นี้ในรูปแบบ level บนสุด
        extendedProps: { manualStatus, description },
      };

      // ✅ ตรวจสอบและเพิ่ม Customer ใหม่ถ้ายังไม่มี (ไม่ต้องเช็คว่า company ต้องมีค่า)
      const existingCustomer = res.userCustomers.find(
        (c) => c.cCompany === company && c.cSite === site
      );

      // ✅ เพิ่มแม้ว่า company จะไม่มีค่า (null หรือ "")
      if (!existingCustomer) {
        await CustomerService.AddCustomer({
          cCompany: company ?? "", // ป้องกัน null โดยแทนเป็น string ว่าง
          cSite: site ?? "",
        });
      }

      // อัปเดต event ใน FullCalendar
      eventInfo.event.setProp("textColor", textColor);
      eventInfo.event.setProp("backgroundColor", backgroundColor);
      eventInfo.event.setExtendedProp("status", status);
      eventInfo.event.setExtendedProp("manualStatus", manualStatus);
      eventInfo.event.setExtendedProp("description", description);

      setEvents((prevEvents) =>
        prevEvents.map((event) => (event.id === id ? updatedEvent : event))
      );

      // ส่งข้อมูลแก้ไขไปยัง API
      await EventService.UpdateEvent(id, updatedEvent);
      await fetchEventsFromDB();
      setLoading(false);

      Swal.fire({
        title: "บันทึกการเปลี่ยนแปลงสำเร็จ",
        icon: "success",
        showConfirmButton: false,
        timer: 1000,
      });
    } else if (result.isDenied) {
      handleDeleteEvent(eventId);
    }
  });
};
