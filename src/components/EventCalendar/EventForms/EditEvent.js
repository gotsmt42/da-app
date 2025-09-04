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
}) => {
  const inputBackgroundColor = document.createElement("input");
  inputBackgroundColor.type = "color";
  inputBackgroundColor.value = eventInfo.event.backgroundColor;

  const inputTextColor = document.createElement("input");
  inputTextColor.type = "color";
  inputTextColor.value = eventInfo.event.textColor;

  const eventId = eventInfo.event.id;
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

  const formattedEnd = eventAllDay
    ? moment(eventEnd).subtract(1, "days").format("YYYY-MM-DDTHH:mm")
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


      <div class="swal-form-grid">
  


      <!-- ชื่อบริษัท -->
      <div>
        <label for="editCompany">ชื่อบริษัท : </label>
        <select id="editCompany" class="swal2-select">
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
  
      <!-- สถานที่ -->
      <div>
        <label for="editSite">ชื่อโครงการ : </label>
        <select id="editSite" class="swal2-select">
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
  
      <!-- ประเภทแผนงาน -->
      <div>
        <label for="editTitle">ประเภทงาน : </label>
        <select id="editTitle" class="swal2-select">
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
      <div>
        <label for="editSystem">ระบบงาน : </label>
        <select id="editSystem" class="swal2-select">
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
      <div>
        <label for="editTime">ครั้งที่ : </label>
        <select id="editTime" class="swal2-select">
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


      <div>
        <label for="editSystem">ทีม : </label>
        <select id="editTeam" class="swal2-select">
          <option disabled selected>${eventTeam || ""}</option>
            ${employeeList
              .map(
                (employee) =>
                  `<option value="${employee.fname}">${employee.fname}</option>`
              )
              .join("")}

        </select>
      </div>
  
  
      
  
    </div>
    <!-- สีพื้นหลัง -->
      <div>
        <label>สีพื้นหลัง : </label><br>
        <div id="backgroundColorPickerContainer"></div>
      </div><br>
  
      <!-- สีข้อความ -->
      <div>
        <label>สีข้อความ : </label><br>
        <div id="textColorPickerContainer" ></div>
      </div><br>
  
      <!-- วันที่เริ่ม -->
      <div >
        <label for="editStart">เริ่มต้น : </label>
        <input id="editStart" type="datetime-local" style="width: 80%; height: 35px" class="swal2-input" value="${eventStart.format(
          "YYYY-MM-DDTHH:mm"
        )}" />
      </div><br>
  
      <!-- วันที่สิ้นสุด -->
      <div>
        <label for="editEnd">สิ้นสุด : </label>
        <input id="editEnd" type="datetime-local" style="width: 80%; height: 35px" class="swal2-input" value="${formattedEnd}" />
      </div><br>
  `;

  Swal.fire({
    title: `<h4>[ ${eventTitle} ] ${eventSystem} ${eventSite}${
      eventTeam ? ` (ทีม ${eventTeam})` : ""
    }</h4>`,
    html: htmlEdit,
    showDenyButton: true,
    showCancelButton: true,
    confirmButtonColor: "#0ECC00",
    confirmButtonText: "บันทึกการเปลี่ยนแปลง",
    denyButtonText: "ลบแผนงาน",
    showExtraButton: true,
    customClass: "swal-wide",
    showCloseButton: true,
    didOpen: () => {
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
    },

    didRender: () => {
      const createButton = (text, color, onClick) => {
        const btn = document.createElement("button");
        btn.innerText = text;
        btn.className = "swal2-confirm swal2-styled";
        btn.style.backgroundColor = color;
        btn.style.marginLeft = "10px";
        btn.onclick = onClick;
        Swal.getActions().appendChild(btn);
      };

      createButton("ออกใบแจ้งเข้างาน", "#0064de", () =>
        generateWorkPermitPDF(eventInfo.event)
      );
      createButton("ดูตารางการดำเนินงาน", "#d602a1", () => {
        window.location.href = `/operation/${eventId}`;
      });
    },
    preConfirm: () => {
      const getVal = (id) => document.getElementById(id)?.value || "";
      const title = getVal("editTitle");
      if (!title) Swal.showValidationMessage("กรุณากรอกชื่อแผนงาน");

      const endInput = getVal("editEnd");
      const end = endInput
        ? eventAllDay
          ? moment(endInput).add(1, "days").toISOString()
          : moment(endInput).toISOString()
        : eventEnd.toISOString();

      return {
        id: eventId,
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
        extendedProps: { manualStatus },
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
