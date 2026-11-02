/**
 * ✅ (2 พ.ย. 2569 ผู้ใช้: "ให้แสดงรูปด้วย ให้สวยงาม") ตัวแสดงผล TomSelect สำหรับช่องเลือกคน
 *    รูปพนักงานหน้าชื่อ (ไม่มีรูป = อักษรย่อบนสีประจำตัว — ชุดเดียวกับ PersonChip)
 *    ใช้กับฟอร์มเพิ่มงาน (AddEvent) · ฟอร์มแก้ไขงานมีตัวของตัวเอง (personAvatarHtml ใน EditEvent)
 *    ⚠️ ต้องใส่ PERSON_TS_CSS ในหน้าด้วย (dropdown ไปแปะที่ <body> — ใช้คลาสส่วนกลาง ไม่ผูกกับ modal)
 */
import { escapeHtml } from "@/shared/utils/escapeHtml";
import { personColor, personInitial } from "@/shared/utils/personAvatar";

export const personAvatar = (name, imageUrl, size = 26) => {
  const box = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px`;
  const letter = `<span class="pts-av" style="${box};background:${personColor(name)}">${escapeHtml(personInitial(name))}</span>`;
  return imageUrl
    ? `<span class="pts-av-wrap" style="${box}">${letter}<img class="pts-av pts-av--img" src="${escapeHtml(imageUrl)}" alt="" style="${box}" onerror="this.remove()"></span>`
    : letter;
};

/** @param imgByName Map(ชื่อ → imageUrl) */
export const personTsRender = (imgByName) => ({
  option: (d, esc) => (d.value
    ? `<div class="pts-person">${personAvatar(d.value, imgByName.get(d.value), 28)}<span>${esc(d.text)}</span></div>`
    : `<div class="pts-person pts-person--muted">${esc(d.text)}</div>`),
  item: (d, esc) => (d.value
    ? `<div class="pts-person">${personAvatar(d.value, imgByName.get(d.value), 24)}<span>${esc(d.text)}</span></div>`
    : `<div>${esc(d.text)}</div>`),
  option_create: (d, esc) => `<div class="create">➕ เพิ่มชื่อ <b>${esc(d.input)}</b></div>`,
});

export const PERSON_TS_CSS = `
  .pts-av { flex-shrink: 0; border-radius: 50%; object-fit: cover; display: inline-flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; line-height: 1; box-sizing: border-box; }
  .pts-av-wrap { position: relative; flex-shrink: 0; display: inline-flex; }
  .pts-av-wrap .pts-av--img { position: absolute; inset: 0; background: #fff; }
  .pts-person { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .pts-person > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; color: #0f172a; }
  .pts-person--muted { color: #94a3b8; }
  .ts-dropdown .pts-person { padding: 2px 0; }
  .ts-dropdown .active .pts-person > span:last-child { color: #1d4ed8; }
`;
