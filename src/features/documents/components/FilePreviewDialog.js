/**
 * FilePreviewDialog.js — ดูไฟล์แนบแบบเต็มจอ (ของกลาง: กล่องวางบิล · เอกสารของงาน · ใบแจ้งงาน)
 *
 * 🔁 (21 ต.ค. 2569 ผู้ใช้: "เลื่อนดูรูปอื่นในช่องเดียวกันได้เลย ไม่ต้องกดเปิดปิด") ใช้กล่องดูไฟล์ตัวกลาง
 *    (shared/ui/FileGalleryDialog) — ส่ง files มาด้วย = เลื่อนดูไฟล์อื่นในช่องเดียวกันได้ (← → · ปัด · แถบรูปย่อ)
 * ⚠️ ซ้อนบนกล่องเดิมเสมอ ไม่ใช่เปลี่ยนหน้า/เปิดแท็บใหม่ — ค่าที่พิมพ์ค้างไว้ในกล่องเดิมไม่หาย
 *
 * @param {object|null} props.file   ไฟล์ที่จะดู — null = ปิด
 * @param {object[]}    [props.files] ไฟล์ทั้งหมดในช่องเดียวกัน
 * @param {string}      [props.caption] คำอธิบายใต้ชื่อไฟล์
 */
import { useEffect, useState } from "react";
import FileGalleryDialog from "@/shared/ui/FileGalleryDialog";

export default function FilePreviewDialog({ file, files, caption, onClose }) {
  const [cur, setCur] = useState(file);
  useEffect(() => { setCur(file); }, [file]);
  if (!file || !cur) return null;
  return (
    <FileGalleryDialog previewUrl={cur.fileUrl} previewFileName={cur.fileName || "ไฟล์แนบ"} caption={caption}
      gallery={files} onNavigate={(f) => setCur(f)} onClose={onClose} />
  );
}
