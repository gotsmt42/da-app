import moment from "moment/min/moment-with-locales";
moment.locale("th");

export const getGeneratePDF = async ({
  jsPDF,
  thSarabunFont,
  event,
  docNo,
  description,
  subject,
  userData,
}) => {
  moment.locale("th"); // ✅ ตั้งค่า locale เป็นภาษาไทย

  const issuerName = userData
    ? `${userData.fname} ${userData.lname}`
    : "ไม่ทราบชื่อผู้ใช้";
  const issuerTel = userData ? userData.tel : "-";
  console.log(issuerName, issuerTel);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "A4",
  });
  doc.addFileToVFS("THSarabun.ttf", thSarabunFont);
  doc.addFont("THSarabun.ttf", "THSarabun", "normal");
  doc.setFont("THSarabun");

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 25;
  const marginRight = 25;
  const marginTop = 50; // เผื่อหัวกระดาษ
  const marginBottom = 20;
  const contentWidth = pageWidth - marginLeft - marginRight;

  // 🔹 ฟังก์ชันวาดหัวกระดาษ (เรียกซ้ำทุกหน้า)
  const drawHeader = () => {
    // โลโก้บริษัท
    const logo = "/logo-light-2.png"; // ✅ ใส่ path/logo ของคุณ
    try {
      const logoProps = doc.getImageProperties(logo);
      const logoWidth = 35;
      const logoHeight = (logoProps.height / logoProps.width) * logoWidth;
      doc.addImage(logo, "PNG", 15, 5, logoWidth, logoHeight);
    } catch (e) {
      console.warn("⚠️ ไม่พบไฟล์โลโก้");
    }

    doc.setFontSize(20);
    doc.text(
      "บริษัท ดู ออล อาคิเทค แอนด์ เอ็นจิเนียริ่ง จำกัด",
      pageWidth / 2,
      20,
      { align: "center" }
    );
    doc.setFontSize(14);
    doc.text("DO ALL ARCHITECT AND ENGINEERING CO.,LTD.", pageWidth / 2, 27, {
      align: "center",
    });
    doc.setFontSize(12);
    doc.text(
      "68/155 หมู่ 3 ถนนชัยพฤกษ์ ตำบลคลองพระอุดม อำเภอปากเกร็ด จังหวัดนนทบุรี 11120",
      pageWidth / 2,
      34,
      { align: "center" }
    );
    doc.line(marginLeft, 40, pageWidth - marginRight, 40); // เส้นคั่นหัวกระดาษ
  };

  // เริ่มต้นด้วยหัวกระดาษ
  drawHeader();

  const siteCompany = event.extendedProps.company
    ? `${event.extendedProps.company} `
    : `โครงการ ${event.extendedProps.site} `;
  const timeText = event.extendedProps.time
    ? `ครั้งที่ ${event.extendedProps.time} `
    : ``;

  // const start = moment(event.start).format("DD-MM-YYYY");
  // const end = moment(event.end).subtract(1, "days").format("DD-MM-YYYY");

  const start = moment(event.start).add(543, "years").format("D MMMM YYYY");
  const end = moment(event.end)
    .subtract(1, "days")
    .add(543, "years")
    .format("D MMMM YYYY");

  const descriptionLines = (description || "").split("\n");

  const lines = [
    "",
    `เรียน  ผู้จัดการโครงการ ${event.extendedProps.site}`,
    "",
    `        ตามที่บริษัท ดู ออล อาคิเทค แอนด์ เอ็นจิเนียริ่ง จำกัด ได้รับความไว้วางใจจาก ${siteCompany} `,
    `ให้เข้าดำเนินการ ${subject} ในระหว่างวันที่ ${start} ถึงวันที่ ${end}`,
    "",
    `        บริษัท ดู ออล อาคิเทค แอนด์ เอ็นจิเนียริ่ง จำกัด ขอแจ้งให้ท่านทราบถึงกำหนดการเข้า ${event.title} ระบบ ${event.extendedProps.system}`,
    `${timeText} ซึ่งทางบริษัทฯ มีกำหนดการเข้าดำเนินการในช่วงเวลาดังนี้`,
    "",
    ...descriptionLines.map((line) => `        ${line}`),
    "",
    "",

    "        ดังนั้น บริษัท ฯ ใคร่ขอความร่วมมือ แจ้งผู้เกี่ยวข้องทุกท่านเพื่อทราบกำหนดการดังกล่าว ทั้งนี้บริษัทจะเข้าดำเนินการโดยไม่ส่งผลกระทบต่อผู้ใช้งานพื้นที่พร้อมมีมาตรการความปลอดภัยตามมาตรฐาน หากท่านไม่สะดวกในการดำเนินการตามวันเวลาดังกล่าวกรุณาแจ้งกลับที่บริษัท ดู ออล อาคิเทค แอนด์ เอ็นจิเนียริ่ง จำกัด ด้วย จักขอบพระคุณยิ่ง",
  ];

  doc.setFontSize(14);
  let y = marginTop;

  const footerReserved = 40 + 0 + 0; // ข้อความ + ช่องเซ็นชื่อ + marginBottom
  // doc.setLineHeightFactor(0.9); // หรือ 0.85 จะชิดขึ้น

  lines.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, contentWidth);
    wrapped.forEach((txt) => {
      if (y > pageHeight - footerReserved) {
        doc.addPage();
        drawHeader();
        doc.setFont("THSarabun"); // 🔹 ตั้ง font ใหม่
        doc.setFontSize(14); // 🔹 ตั้งขนาดใหม่
        y = marginTop;
      }
      doc.text(txt, marginLeft, y);
      if (descriptionLines.some((desc) => line.includes(desc))) {
        y += 6; // ชิดมากขึ้นสำหรับ description
      } else {
        y += 6; // ปกติสำหรับหัวข้อ
      }
    });
  });

  // 🔹 Footer (ข้อความ + ช่องเซ็นชื่อ อยู่ล่างเสมอ)
  const footerTextY = pageHeight - marginBottom - 65; // ตำแหน่งข้อความเหนือช่องเซ็นชื่อ
  doc.setFont("THSarabun");
  doc.setFontSize(14);
  // doc.text(
  //   "        ดังนั้น บริษัท ฯ ใคร่ขอความร่วมมือ แจ้งผู้เกี่ยวข้องทุกท่านเพื่อทราบกำหนดการดังกล่าว ทั้งนี้บริษัทจะเข้าดำเนินการโดยไม่ส่งผลกระทบต่อผู้ใช้งานพื้นที่พร้อมมีมาตรการความปลอดภัยตามมาตรฐาน หากท่านไม่สะดวกในการดำเนินการตามวันเวลาดังกล่าวกรุณาแจ้งกลับที่บริษัท ดู ออล อาคิเทค แอนด์ เอ็นจิเนียริ่ง จำกัด ด้วย จักขอบพระคุณยิ่ง",
  //   marginLeft,
  //   footerTextY,
  //   { maxWidth: contentWidth } // ✅ ตัดบรรทัดอัตโนมัติ
  // );

  // 🔹 ช่องเซ็นชื่อ (อยู่ล่างกระดาษเสมอ)
  const boxHeight = 40;
  const boxSpacing = 10;
  const boxWidth = (contentWidth - boxSpacing) / 2;
  const boxY = pageHeight - marginBottom - boxHeight; // ✅ อยู่ล่างกระดาษเสมอ

  // ช่องลูกค้า
  doc.rect(marginLeft, boxY, boxWidth, boxHeight);
  doc.setFontSize(14);
  doc.text("ลงชื่อผู้รับทราบ (ลูกค้า)", marginLeft + 5, boxY + 10);
  doc.text(
    "ลงชื่อ ...........................................",
    marginLeft + 5,
    boxY + 25
  );
  doc.text(
    "วันที่ ........../........../..........",
    marginLeft + 5,
    boxY + 35
  );

  // ช่องผู้ออกเอกสาร
  const rightBoxX = marginLeft + boxWidth + boxSpacing;
  doc.rect(rightBoxX, boxY, boxWidth, boxHeight);
  doc.setFontSize(14);

  doc.text(
    `         ผู้ออกเอกสาร (ผู้รับผิดชอบโครงการ)`,
    rightBoxX + 5,
    boxY + 10
  );
  doc.text(
    `              ${issuerName} (${issuerTel})`,
    rightBoxX + 5,
    boxY + 20
  );

  doc.text(
    "ลงชื่อ .......................................................................",
    rightBoxX + 5,
    boxY + 22
  );
  doc.text(
    `วันที่:   ${moment().format("DD/MM/YYYY")}`,
    rightBoxX + 5,
    boxY + 35
  );

  // 🔹 บันทึกไฟล์
  const safeFileName = `ใบแจ้งขอเข้างาน (${subject})`.replace(
    /[\/\\:*?"<>|]/g,
    "_"
  );
  const pdfBlob = doc.output("blob");
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, "_blank");

  const link = document.createElement("a");
  link.href = pdfUrl;
  link.download = `${safeFileName}.pdf`;
  link.click();
};
