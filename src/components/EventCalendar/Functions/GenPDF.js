import moment from "moment";
import "moment/locale/th";

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
  const marginBottom = 30;
  const contentWidth = pageWidth - marginLeft - marginRight;

  // 🔹 ฟังก์ชันวาดหัวกระดาษ (เรียกซ้ำทุกหน้า)
  const drawHeader = () => {
    // โลโก้บริษัท
    const logo = "/logo-light-2.png"; // ✅ ใส่ path/logo ของคุณ
    try {
      const logoProps = doc.getImageProperties(logo);
      const logoWidth = 40
      const logoHeight = (logoProps.height / logoProps.width) * logoWidth;
      doc.addImage(logo, "PNG", 23.5, 4, logoWidth, logoHeight);
    } catch (e) {
      console.warn("⚠️ ไม่พบไฟล์โลโก้");
    }

    doc.setFontSize(20);
    doc.text(
      "บริษัท ดู ออล อาคิเทค แอนด์ เอ็นจิเนียริ่ง จำกัด",
      pageWidth / 1.9,
      20,
      { align: "center" },
    );
    doc.setFontSize(14);
    doc.text("DO ALL ARCHITECT AND ENGINEERING CO.,LTD.", pageWidth / 1.9, 28, {
      align: "center",
    });
    doc.setFontSize(12);
    doc.text(
      "68/155 หมู่ 3 ถนนชัยพฤกษ์ ตำบลคลองพระอุดม อำเภอปากเกร็ด จังหวัดนนทบุรี 11120 / info.doall.ae@gmail.com / Tel. 097-085-7411",
      pageWidth / 2,
      36,
      { align: "center" },
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
          const docNoText = event.extendedProps.docNo
      ? `อ้างอิงเลขที่เอกสาร: ${event.extendedProps.docNo} `
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
    `ให้เข้าดำเนินการ ${subject} ในระหว่างวันที่ ${start} ถึงวันที่ ${end} ${docNoText}`,
    "",
    `        บริษัท ดู ออล อาคิเทค แอนด์ เอ็นจิเนียริ่ง จำกัด ขอแจ้งให้ท่านทราบถึงกำหนดการเข้า ${event.title} ระบบ ${event.extendedProps.system}`,
    `${timeText} ซึ่งทางบริษัทฯ มีกำหนดการเข้าดำเนินการในช่วงเวลาดังนี้`,
    "",
    ...descriptionLines.map((line) => `        ${line}`),
    "",
    "        ดังนั้น บริษัท ฯ ใคร่ขอความร่วมมือ แจ้งผู้เกี่ยวข้องทุกท่านเพื่อทราบกำหนดการดังกล่าว ทั้งนี้บริษัทจะเข้าดำเนินการโดยไม่ส่งผลกระทบต่อผู้ใช้งานพื้นที่พร้อมมีมาตรการความปลอดภัยตามมาตรฐาน หากท่านไม่สะดวกในการดำเนินการตามวันเวลาดังกล่าวกรุณาแจ้งกลับที่บริษัท ดู ออล อาคิเทค แอนด์ เอ็นจิเนียริ่ง จำกัด ด้วย จักขอบพระคุณยิ่ง",
    "",
  ];

  doc.setFontSize(14);
  let y = marginTop;

  const footerReserved = 20 + 35 + 10; // ข้อความ + ช่องเซ็นชื่อ + marginBottom
  // doc.setLineHeightFactor(0.9); // หรือ 0.85 จะชิดขึ้น

// counter ควรเก็บไว้ในระบบ (เช่น DB หรือ state) เพื่อให้รันต่อเนื่อง
let counter = 1;

const generateDocNo = () => {
  // วันที่ + เวลา
  const dateTimePart = moment().format("YYYYMMDD-HHmmss");

  // เลขนับขึ้น (3 หลัก)
  const counterPart = String(counter).padStart(3, "0");

  // รวมเป็นเลขที่เอกสาร
  const docNo = `DOC-${dateTimePart}-${counterPart}`;

  // เพิ่ม counter ทุกครั้งที่เรียก
  counter++;

  return docNo;
};

docNo = generateDocNo(); // ✅ สร้างเลขที่เอกสารใหม่
// ใช้งาน

  const drawFooter = (doc, docNo) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginBottom = 10;

    // 🔹 เส้นคั่น footer
    doc.setDrawColor(0); // สีดำ
    doc.setLineWidth(0.5);
    doc.line(
      25,
      pageHeight - marginBottom - 5,
      pageWidth - 25,
      pageHeight - marginBottom - 5,
    );


    doc.setFontSize(12);
    doc.text(
      `${docNo} | หน้า ${doc.internal.getNumberOfPages()} | วันที่ ${moment().format("DD/MM/YYYY")}`,
      pageWidth / 2,
      pageHeight - marginBottom,
      { align: "center" },
    );
  };

  lines.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, contentWidth);
    wrapped.forEach((txt) => {
      if (y > pageHeight - footerReserved) {
        drawHeader();
        drawFooter(doc, docNo); // ✅ เพิ่ม footer ทุกหน้า
        doc.setFont("THSarabun");
        doc.setFontSize(14);
        doc.addPage();
        drawHeader();
        drawFooter(doc, docNo); // ✅ เพิ่ม footer ทุกหน้า
        doc.setFont("THSarabun");
        doc.setFontSize(14);
        y = marginTop;
      }
      doc.text(txt, marginLeft, y);
      y += 6;
    });
  });

  // หลังจากวาดเนื้อหาหน้าแรกเสร็จ
  drawFooter(doc, docNo);

  // 🔹 Footer (ข้อความ + ช่องเซ็นชื่อ อยู่ล่างเสมอ)
  // const footerTextY = pageHeight - marginBottom - 85; // ตำแหน่งข้อความเหนือช่องเซ็นชื่อ
  // doc.setFont("THSarabun");
  // doc.setFontSize(14);
  // doc.text(
  //   "",
  //   marginLeft,
  //   footerTextY,
  //   { maxWidth: contentWidth }, // ✅ ตัดบรรทัดอัตโนมัติ
  // );

  // 🔹 ช่องเซ็นชื่อ (อยู่ล่างกระดาษเสมอ)
  const boxHeight = 40;
  const boxSpacing = 10;
  const boxWidth = (contentWidth - boxSpacing) / 2;
  const boxY = pageHeight - 20 - boxHeight; // ✅ อยู่ล่างกระดาษเสมอ

  // ช่องลูกค้า
  // doc.rect(marginLeft, boxY, boxWidth, boxHeight);
  doc.setFontSize(15);
  doc.text("ลงชื่อผู้รับทราบ (ลูกค้า)", marginLeft + 1, boxY + 5);
  doc.text(
    "ลงชื่อ .........................................................",
    marginLeft - 5,
    boxY + 24,
  );
  doc.text(
    "วันที่ ................./.................../...................",
    marginLeft - 5,
    boxY + 35,
  );

  // 🔹 ตราประทับตรงกลางระหว่างช่องเซ็นชื่อ
  try {
    const stamp = "/stamp.png"; // path ของไฟล์ตราประทับ (ใส่ไว้ใน public/)
    const stampProps = doc.getImageProperties(stamp);
    const stampWidth = 50; // กำหนดความกว้างของตรา
    const stampHeight = (stampProps.height / stampProps.width) * stampWidth;

    // คำนวณตำแหน่งให้อยู่ตรงกลางระหว่างสองช่อง
    const centerX = pageWidth / 2 - stampWidth / 2;
    const centerY = boxY + 10 / 2 - stampHeight / 2;

    doc.addImage(stamp, "PNG", centerX, centerY, stampWidth, stampHeight);
  } catch (e) {
    console.warn("⚠️ ไม่พบไฟล์ตราประทับ");
  }

  // ช่องผู้ออกเอกสาร
  const rightBoxX = marginLeft + boxWidth + boxSpacing;
  // doc.rect(rightBoxX, boxY, boxWidth, boxHeight);
  doc.setFontSize(15);

  doc.text(
    `         ผู้ออกเอกสาร (ผู้รับผิดชอบโครงการ)`,
    rightBoxX + 20,
    boxY + 5,
  );
  doc.text(
    `              ${issuerName} (${issuerTel})`,
    rightBoxX + 20,
    boxY + 20,
  );

  doc.text(
    "ลงชื่อ ...........................................................",
    rightBoxX + 20,
    boxY + 24,
  );

  doc.text(`${moment().format("DD / MM / YYYY")}`, rightBoxX + 35, boxY + 35);

  doc.text(
    "วันที่ ............................................................",
    rightBoxX + 20,
    boxY + 37,
  );

  // 🔹 บันทึกไฟล์
  const safeFileName = `ใบแจ้งขอเข้างาน (${subject})`.replace(
    /[\/\\:*?"<>|]/g,
    "_",
  );
  const pdfBlob = doc.output("blob");
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, "_blank");

  const link = document.createElement("a");
  link.href = pdfUrl;
  link.download = `${safeFileName}.pdf`;
  link.click();
};
