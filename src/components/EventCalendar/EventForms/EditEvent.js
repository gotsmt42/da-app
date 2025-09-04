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
  const eventDocNo = eventInfo.event.extendedProps?.docNo || "";
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
  let isAutoUpdated = eventInfo.event.extendedProps?.isAutoUpdated || false;

  const formattedEnd = eventAllDay
    ? moment(eventEnd).subtract(1, "days").format("YYYY-MM-DDTHH:mm")
    : moment(eventEnd).format("YYYY-MM-DDTHH:mm");

  const getBackgroundColorByStatus = (status) => {
    switch (status) {
      case "กำลังรอยืนยัน":
        return "#FF5733"; // สีส้ม
      case "ยืนยันแล้ว":
        return "#0c49ac"; // สีน้ำเงิน
      case "กำลังดำเนินการ":
        return "#d1c000"; // สีเหลือง
      case "ดำเนินการเสร็จสิ้น":
        return "#7bff00"; // สีเขียว (เอา # ตัวที่สองออก)
      default:
        return "#ffffff"; // สีขาว
    }
  };

  const getTextColorByStatus = (status) => {
    switch (status) {
      case "กำลังรอยืนยัน":
        return "#ffffff"; // ดำ
      case "ยืนยันแล้ว":
        return "#ffffff"; // ขาว
      case "กำลังดำเนินการ":
        return "#000000"; // ขาว
      case "ดำเนินการเสร็จสิ้น":
        return "#000000"; // ดำ (แก้จาก ##fff เป็น #000)
      default:
        return "#ffffff"; // ขาว
    }
  };

  let currentTextColor = getTextColorByStatus(eventStatus);
  let currentBackgroundColor = getBackgroundColorByStatus(eventStatus);

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
    customClass: "swal-wide",
    showCloseButton: true,
    didOpen: () => {
      const statusColorMap = {
        // ยกเลิก: "#d33",
        กำลังรอยืนยัน: "#888888",
        ยืนยันแล้ว: "#0c49ac",
        กำลังดำเนินการ: "#a1b50b",
        // เสนอราคาแก้ไขแล้ว: "#f39c12",
        // วางบิลแล้วรอเก็บเงิน: "#9b59b6",
        ดำเนินการเสร็จสิ้น: "#18b007",
      };

      const statusSelect = new TomSelect("#editStatus", {
        create: false,
        // maxOptions: 5,
        placeholder: "เลือกสถานะงาน",
        render: {
          option: function (data, escape) {
            const iconMap = {
              // ยกเลิก: "fa-times-circle",                     // ❌ ไอคอนปิด/ยกเลิก
              กำลังรอยืนยัน: "fa-hourglass-half", // ⏳
              ยืนยันแล้ว: "fa-check", // ✔️
              กำลังดำเนินการ: "fa-clock-rotate-left", // 🕒
              // เสนอราคาแก้ไขแล้ว: "fa-file-signature",       // 📝
              // วางบิลแล้วรอเก็บเงิน: "fa-file-invoice-dollar", // 📄💸
              ดำเนินการเสร็จสิ้น: "fa-check-double", // 💰
            };
            const color = statusColorMap[data.value] || "#ccc";
            const icon = iconMap[data.value] || "fa-circle";

            return `
                <div style="display: flex; align-items: center; gap: 8px;">
                  <i class="fas ${icon}" style="color: ${color}; width: 18px;"></i>
                  <span>${escape(data.text)}</span>
                </div>`;
          },
          item: function (data, escape) {
            return `<div>${escape(data.text)}</div>`;
          },
        },
        onChange: function (value) {
          const control = statusSelect.control_input.parentElement; // .ts-control
          const color = statusColorMap[value] || "#ccc";
          control.style.backgroundColor = color;
          control.style.color = value === "กำลังดำเนินการ" ? "#000" : "#fff";
          control.style.borderColor = "#999";
        },
      });

      // ✅ เซ็ตสีเริ่มต้นตามสถานะที่โหลดมา
      const initialColor = statusColorMap[statusSelect.getValue()] || "#ccc";
      statusSelect.control_input.parentElement.style.backgroundColor =
        initialColor;
      statusSelect.control_input.parentElement.style.color =
        statusSelect.getValue() === "กำลังดำเนินการ" ? "#000" : "#fff";

      new TomSelect("#editCompany", {
        create: true, // ✅ อนุญาตให้ผู้ใช้พิมพ์ชื่อใหม่ได้
        maxOptions: 7,

        placeholder: "เลือกหรือพิมพ์ชื่อบริษัท",
        sortField: {
          field: "text",
          direction: "asc",
        },
      });

      new TomSelect("#editSite", {
        create: true, // ✅ อนุญาตให้ผู้ใช้พิมพ์ชื่อใหม่ได้
        maxOptions: 7,

        placeholder: "เลือกหรือพิมพ์ชื่อโครงการ",
        sortField: {
          field: "text",
          direction: "asc",
        },
      });

      new TomSelect("#editTitle", {
        create: true, // ✅ อนุญาตให้ผู้ใช้พิมพ์ชื่อใหม่ได้
        placeholder: "เลือกหรือพิมพ์ชื่อหัวข้อ",

        sortField: {
          field: "text",
          direction: "asc",
        },
      });

      new TomSelect("#editSystem", {
        create: true, // ✅ อนุญาตให้ผู้ใช้พิมพ์ชื่อใหม่ได้
        placeholder: "เลือกหรือพิมพ์ชื่อระบบ",
        sortField: {
          field: "text",
          direction: "asc",
        },
      });

      new TomSelect("#editTime", {
        create: true, // ✅ อนุญาตให้ผู้ใช้พิมพ์ชื่อใหม่ได้
        placeholder: "เลือกหรือพิมพ์ครั้งที่",

        sortField: {
          field: "text",
          direction: "asc",
        },
      });
      new TomSelect("#editTeam", {
        create: true, // ✅ อนุญาตให้ผู้ใช้พิมพ์ชื่อใหม่ได้
        placeholder: "เลือกหรือพิมพ์ชื่อทีม",

        sortField: {
          field: "text",
          direction: "asc",
        },
      });

      inputBackgroundColor.style.width = "150px";
      inputBackgroundColor.style.height = "35px";
      inputBackgroundColor.style.border = "4px solid #ccc";
      // inputBackgroundColor.style.borderRadius = "6px";
      inputBackgroundColor.style.cursor = "pointer";

      inputTextColor.style.width = "150px";
      inputTextColor.style.height = "35px";
      inputTextColor.style.border = "4px solid #ccc";
      // inputTextColor.style.borderRadius = "6px";
      inputTextColor.style.cursor = "pointer";

      document
        .getElementById("backgroundColorPickerContainer")
        .appendChild(inputBackgroundColor);
      document
        .getElementById("textColorPickerContainer")
        .appendChild(inputTextColor);
    },
    showDenyButton: true,
    showCancelButton: true,
    confirmButtonColor: "#0ECC00",
    confirmButtonText: "บันทึกการเปลี่ยนแปลง",
    denyButtonText: "ลบแผนงาน",
    // cancelButtonText: "ยกเลิกแผนงาน",
    showExtraButton: true,
    didRender: () => {
      const pdfButton = document.createElement("button");
      pdfButton.innerText = "ออกใบแจ้งเข้างาน";
      pdfButton.className = "swal2-confirm swal2-styled";
      pdfButton.style.backgroundColor = "#0064de"; // สีเทา
      pdfButton.style.marginLeft = "10px";
      pdfButton.onclick = () => generateWorkPermitPDF(eventInfo.event);
      Swal.getActions().appendChild(pdfButton);

      // ✅ ปุ่ม Redirect ไปหน้า Operation
      const operationButton = document.createElement("button");
      operationButton.innerText = "ดูตารางการดำเนินงาน";
      operationButton.className = "swal2-confirm swal2-styled";
      operationButton.style.backgroundColor = "#d602a1";
      operationButton.style.marginLeft = "10px";
      operationButton.onclick = () => {
        window.location.href = `/operation/${eventId}`; // ✅ แนบ eventId ใน URL
      };
      Swal.getActions().appendChild(operationButton);
    },
    preConfirm: () => {
      const company = document.getElementById("editCompany").value;
      const site = document.getElementById("editSite").value;
      const title = document.getElementById("editTitle").value;
      const system = document.getElementById("editSystem").value;
      const time = document.getElementById("editTime").value;
      const team = document.getElementById("editTeam").value;
      const textColor = inputTextColor.value;
      const backgroundColor = inputBackgroundColor.value;
      const fontSize = eventFontSize;
      const status = document.getElementById("editStatus").value;
      const start = moment(
        document.getElementById("editStart").value
      ).toISOString();
      let end = document.getElementById("editEnd").value;
      if (!end) {
        end = eventEnd.toISOString();
      } else {
        end = eventAllDay
          ? moment(end).add(1, "days").toISOString()
          : moment(end).toISOString();
      }
      if (!title) {
        Swal.showValidationMessage("กรุณากรอกชื่อแผนงาน");
      }
      // ส่งกลับข้อมูลพร้อมกับ flag manualStatus: true
      return {
        id: eventId,
        company: company || "", // ✅ ถ้าไม่กรอก ให้เป็น string ว่าง
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
    // else if (result.dismiss === Swal.DismissReason.cancel) {
    //   confirmCancelEvent(eventId);
    // }
  });
};
