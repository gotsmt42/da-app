/**
 * MobileHome — หน้าแรกบน "จอมือถือ" แบบแอป
 *
 * ✅ (1 พ.ย. 2569 ผู้ใช้ส่งภาพตัวอย่าง: "อยากได้แบบคล้ายๆในรูป · ux ui icon สวยงามทันสมัย")
 *   เดิมหน้าแรกมือถือ = การ์ดหมวดเมนู 6–8 ใบเรียงลงมา (หัวการ์ดใหญ่ ที่ว่างเยอะ)
 *   ตอนนี้ (เรียงตามที่ผู้ใช้ปรับหลายรอบ "ให้คล้ายๆเดิม"):
 *     1. การ์ดทักทาย + ทางเข้า "งานของฉัน" พร้อมสรุป ต้องทำ/ค้าง/รอตรวจ
 *     2. ต้องดำเนินการ — การ์ดแถวเดียวเลื่อนข้าง (แบบหน้าเดิม)
 *     3. เมนูตามหมวดเดิม (งาน · เบิกค่าใช้จ่าย · จัดซื้อ · คลังแผนก …) ปุ่มเล็กแบบเดิม — หมวดเล็กวางคู่ครึ่งจอ
 *        ทุกเมนูอยู่บนหน้าครบ ไม่มีอะไรซ่อน
 *   ไอคอน: Material Rounded ทึบ ไล่สีอ่อน→เข้ม ไม่มีกล่องพื้นหลัง (ผู้ใช้สั่ง 27 ต.ค. 2569: "ไม่ต้องมีพื้นหลัง icon")
 *   ฟอนต์: ห้ามเกิน font-weight 700 — IBM Plex Sans Thai โหลดไว้แค่ 400–700 เกินนั้นเบราว์เซอร์ทำตัวหนาปลอม (ดูแข็ง)
 *
 * ⚠️ ใครเห็นเมนูไหน = buildHomeMenu (เงื่อนไขเดียวกับเมนูข้าง) — ไฟล์นี้แค่ "จัดวาง" ไม่ตัดสินสิทธิ์เอง
 * ⚠️ ตัวเลขค้างมาจาก useAppBadges (store เดียวกับแถบล่าง/เมนูข้าง) — ห้ามคำนวณเองที่นี่
 * ⚠️ จอคอม/แท็บเล็ตยังใช้ HomeMenu เดิม (Dashboard.js เลือกตามความกว้างจอ)
 */
import { Link } from "react-router-dom";
// ไอคอนเมนูมาจากทะเบียนกลาง (navConfig → shared/ui/appIcons.js) — ชุดเดียวกับเมนูข้าง/แถบล่างทั้งแอป
import WbSunnyRounded from "@mui/icons-material/WbSunnyRounded";
import WbTwilightRounded from "@mui/icons-material/WbTwilightRounded";
import NightsStayRounded from "@mui/icons-material/NightsStayRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";

import useAppBadges, { BADGE_LABEL } from "@/shared/hooks/useAppBadges";
import { buildHomeMenu } from "./HomeMenu";
import IconGradients, { gradFill } from "@/shared/ui/IconGradients";
import { AppIcon } from "@/shared/ui/appIcons";
import "./MobileHome.css";

const iconOf = (it) => it.icon;
/** ชื่อสั้นที่ซ้ำกันข้ามหมวด ("รายงาน" มี 3 ที่) — หน้าแรกไม่มีหัวหมวดกำกับ จึงต้องบอกให้ชัดว่ารายงานอะไร */
const LABEL = {
  expenseReport: "รายงานเบิก", purchaseReport: "รายงานซื้อ", jobReport: "สรุปงาน",
  // ⚠️ "ติดตามใบเสนอราคา" ห้ามย่อเป็น "ใบเสนอราคา" — ผู้ใช้ยืนยันชื่อเต็ม (เป็นหน้าติดตามผล ไม่ใช่ตัวเอกสาร)
  contractorPay: "ผู้รับเหมา",
};
const labelOf = (it) => LABEL[it.key] || it.short || it.title;

/**
 * ✅ (1 พ.ย. 2569 ผู้ใช้: "ลำดับความสำคัญของเมนูให้ดี") — ในแต่ละกลุ่มเรียงตามความถี่ที่ใช้จริง:
 *    งานประจำวัน → เบิกเงิน → อนุมัติ/ติดตาม → ข้อมูล → รายงาน (ดูย้อนหลัง ใช้น้อยสุด อยู่ท้าย)
 */
const MENU_PRIORITY = [
  "myJobs", "jobIntake", "dispatch", "sales", "eventService", "eventOwn", "eventMine", "eventServiceReadOnly", "operation",
  "advance", "claim", "expenseInbox", "finance", "contractorPay", "attendance",
  "purchase", "stock", "ot", "customers", "staff", "documents",
  "webLeads", "webProducts", "webProjects", "webArticles", "webSettings",
  "jobReport", "expenseReport", "purchaseReport",
];
const rankOf = (it) => { const i = MENU_PRIORITY.indexOf(it.key); return i < 0 ? MENU_PRIORITY.length : i; };
const byPriority = (a, b) => rankOf(a) - rankOf(b);
/** คำอธิบายบนการ์ด "ต้องดำเนินการ" — ป้ายกลางขึ้นต้นด้วยชื่อเมนูซ้ำ ("การดำเนินงาน: คำขอปิดงาน…") ตัดออก */
const todoSub = (it) => String(BADGE_LABEL[it.badgeKey] || it.sub || "").replace(/^[^:]{1,30}:\s*/, "");
const greetingOf = (h) => (h < 12
  ? { text: "สวัสดีตอนเช้า", Icon: WbSunnyRounded, tone: "#f59e0b" }
  : h < 17 ? { text: "สวัสดีตอนบ่าย", Icon: WbTwilightRounded, tone: "#f59e0b" }
    : { text: "สวัสดีตอนเย็น", Icon: NightsStayRounded, tone: "#6366f1" });

const countText = (n) => (n > 99 ? "99+" : String(n));

/** หมวดที่ไม่แสดงบนหน้าแรก (ยังอยู่ในเมนูข้าง) */
export const HOME_HIDDEN_CATS = ["website"];

/**
 * สีปุ่มหลัก 4 ช่อง — แบบหน้าแรก Agoda (ผู้ใช้ส่งภาพเทียบ 1 พ.ย. 2569: "ลักษณะแบบ Agoda พื้นขาว สีสัน")
 *    tint พื้นพาสเทลเต็มช่อง · hill เนินสีสดครึ่งวงกลมที่ก้นช่อง (ไอคอนขาววางบนเนิน)
 *    ink สีไอคอน (เฉดเข้มของช่อง) ในวงกลมขาวบนเนิน — ผู้ใช้: "icon สีขาวกลมกลืนเกินไป" (เดิมไอคอนขาวบนเนิน)
 */
const HUB_TONES = [
  { tint: "#ffe6e9", ink: "#e11d48", hill: "linear-gradient(180deg, #fb9aaa 0%, #f2718a 100%)" },
  { tint: "#f2e6fc", ink: "#9333ea", hill: "linear-gradient(180deg, #d3a6f5 0%, #b47ae8 100%)" },
  { tint: "#ddf3fd", ink: "#0284c7", hill: "linear-gradient(180deg, #8fd0f5 0%, #55b2ea 100%)" },
  { tint: "#fdf1d2", ink: "#d97706", hill: "linear-gradient(180deg, #fbc56e 0%, #f5a33c 100%)" },
];

/**
 * @param {object} props
 * @param {object} props.userData
 * @param {string} props.rankText            ป้ายตำแหน่ง
 * @param {string} props.dateText            วันที่ภาษาไทย
 * @param {Array<{text:string, tone?:string}>} props.summary  สรุปวันนี้ (หน้าแม่คำนวณ)
 * @param {object} [props.badges]            ตัวเลขที่หน้าแม่มีสดกว่า เช่น { quotations }
 */
export default function MobileHome({ userData, rankText, dateText, summary = [], badges = {}, showMyJobs = false }) {
  const { badges: shared } = useAppBadges(userData);
  const counts = { ...shared, ...badges };
  const countOf = (it) => (it.badgeKey ? Number(counts[it.badgeKey]) || 0 : 0);

  // ⚠️ (1 พ.ย. 2569 ผู้ใช้: "เมนูจากเว็บให้ซ่อนไว้ก่อน ยังไม่ต้องแสดงหน้าแรก") — ยังเข้าได้จากเมนูข้าง
  const cats = buildHomeMenu(userData).filter((c) => !HOME_HIDDEN_CATS.includes(c.key));
  const flat = cats.flatMap((c) => c.items.map((it) => ({ ...it, tone: it.tone || c.tone, cat: c.key })));

  // 🔁 (1 พ.ย. 2569 ผู้ใช้: "ปรับให้เป็นปุ่มเล็กแบบเดิม แต่ icon โมเดิร์นที่ทำมา") — เลิกปุ่มใหญ่ 4 ใบ
  //    หมวด "งาน" กลับเป็นแถวปุ่มเล็กแบบหมวดอื่น · "งานของฉัน" อยู่บนการ์ดทักทาย (ไม่ซ้ำในแถว)
  const used = new Set(showMyJobs ? flat.filter((it) => it.key === "myJobs").map((it) => it.href) : []);

  // ── ต้องดำเนินการ: เมนูที่มีเลขค้าง (ไม่ซ้ำปลายทาง) มาก → น้อย — ชุดเดียวกับหน้าจอคอม (HomeMenu) ──
  // ✅ (1 พ.ย. 2569 ผู้ใช้: "อธิบายแบบเดิมด้วย · ต้องดำเนินการ") หน้าเดิมบอกชัดว่าค้างเรื่องอะไรกี่รายการ — คงไว้
  const todoSeen = new Set();
  const todo = flat
    .filter((it) => countOf(it) > 0 && !todoSeen.has(it.href) && todoSeen.add(it.href))
    .sort((a, b) => countOf(b) - countOf(a));

  const myJobsLink = showMyJobs;

  // ── 🎨 (1 พ.ย. 2569 ผู้ใช้: "อยากได้ UX UI สะอาดตาแบบ Agoda") ──────────────────────────────
  //    พื้นขาวล้วน · เส้นขอบบางแทนเงา · หัวข้อน้อย · แบ่งส่วนด้วยแถบเทาเต็มจอ
  //    1) ปุ่มหลัก 4 ช่องพาสเทล (หมวด "งาน") — ชื่อด้านบน ไอคอนบนเนินสีด้านล่าง
  //    2) เมนูอื่นทั้งหมดในกรอบเดียว ไม่มีหัวหมวด (สีไอคอนบอกหมวดอยู่แล้ว) เรียงตามหมวดเดิม
  //    3) ต้องดำเนินการ — หัวข้อตัวหนาใหญ่ + การ์ดเลื่อนข้างขอบบาง
  const rest = flat.filter((it) => !used.has(it.href));
  const hubs = rest.filter((it) => it.cat === "do" || it.cat === "work").sort(byPriority).slice(0, 4);
  hubs.forEach((it) => used.add(it.href));
  // 🔁 (1 พ.ย. 2569 ผู้ใช้: "เมนูอยากแยกหมวดหมู่ให้ใช้งานง่าย แบบนี้ปนกันหมด") — ในกรอบเดียวแบ่งตามหมวดเดิม
  //    ชื่อหมวดตัวเล็กสีเทา + เส้นคั่นบาง (ยังสะอาดตา) · หมวด 1–2 เมนูวางคู่กันครึ่งกรอบ
  const groups = cats
    .map((c) => ({ key: c.key, title: c.title, tone: c.tone, items: flat.filter((it) => it.cat === c.key && !used.has(it.href)).sort(byPriority) }))
    .filter((grp) => grp.items.length);
  const blocks = [];
  let pair = [];
  groups.forEach((grp) => {
    if (grp.items.length <= 2) {
      pair.push(grp);
      if (pair.length === 2) { blocks.push({ kind: "pair", groups: pair }); pair = []; }
    } else blocks.push({ kind: "full", group: grp });
  });
  if (pair.length) blocks.push({ kind: "pair", groups: pair });

  const g = greetingOf(new Date().getHours());
  const GIcon = g.Icon;

  return (
    <div className="mh">
      <IconGradients tones={[...flat.map((it) => it.tone), ...HUB_TONES.map((h) => h.ink)]} />

      {/* ── 1. ทักทาย (ไม่มีกล่อง แบบหัวหน้าแอป) ── */}
      <header className="mh-greet">
        <div className="mh-greet-hi">{g.text} <GIcon className="mh-greet-icon" style={{ color: g.tone }} aria-hidden="true" /> · {dateText}</div>
        <div className="mh-greet-row">
          <h1 className="mh-greet-name">{userData?.fname || "ผู้ใช้งาน"}</h1>
          {rankText && <span className="mh-rank">{rankText}</span>}
        </div>
      </header>

      {myJobsLink ? (
        // ✅ (1 พ.ย. 2569 ผู้ใช้: "งานของฉันหายไปไหน") — ทุกคนยกเว้นเซลมี "งานของฉัน" (แอดมิน/ผู้จัดการก็รับผิดชอบงานได้)
        // 🔁 (1 พ.ย. 2569 ผู้ใช้: "ปุ่มดูไม่เข้าธีม") หน้าตาเดียวกับปุ่ม 4 ช่อง — ไอคอนในวงกลมสีอ่อน · ชื่อตัวหนา · สรุปใต้ชื่อ
        <Link to="/technician/jobs" className="mh-myjobs">
          <span className="mh-myjobs-art" aria-hidden="true"><AppIcon.MyJobs className="mh-myjobs-icon" style={gradFill("#dc2626")} /></span>
          <span className="mh-myjobs-text">
            <span className="mh-myjobs-title">งานของฉัน</span>
            <span className="mh-myjobs-sum">
            {summary.map((s, i) => (
              <span key={s.text} style={s.tone ? { color: s.tone, fontWeight: 700 } : undefined}>{i > 0 && <i aria-hidden="true">·</i>}{s.text}</span>
            ))}
            </span>
          </span>
          <ChevronRightRounded className="mh-myjobs-go" aria-hidden="true" />
        </Link>
      ) : summary.length > 0 && (
        <div className="mh-myjobs mh-myjobs--plain">
          <span className="mh-myjobs-sum">
            {summary.map((s, i) => <span key={s.text}>{i > 0 && <i aria-hidden="true">·</i>}{s.text}</span>)}
          </span>
        </div>
      )}

      {/* ── ต้องดำเนินการ — 🔁 (1 พ.ย. 2569 ผู้ใช้: "ย้ายมาแทรกด้านบนให้ดูง่ายชัดเจน") ใต้งานของฉัน ก่อนปุ่มหลัก ── */}
      {todo.length > 0 && (
        <>
          <section className="mh-sec">
            <div className="mh-sec-head">
              <h2>ต้องดำเนินการ</h2>
              <span className="mh-sec-pill">{todo.length} เรื่อง</span>
            </div>
            <div className="mh-todo" role="list">
              {todo.map((it) => {
                const Icon = iconOf(it);
                const n = countOf(it);
                return (
                  <Link key={it.key} to={it.href} role="listitem" className="mh-todo-item" style={{ "--mh-tone": it.tone }}
                    aria-label={`${it.title} (${BADGE_LABEL[it.badgeKey] || "ค้าง"} ${n})`}>
                    <span className="mh-todo-top">
                      <Icon className="mh-todo-icon" style={gradFill(it.tone)} />
                      <span className="mh-todo-count">{countText(n)}</span>
                    </span>
                    <span className="mh-todo-name">{labelOf(it)}</span>
                    <span className="mh-todo-sub">{todoSub(it)}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      )}
      {/* ── 2. ปุ่มหลัก 4 ช่อง (หมวด "งาน") ── */}
      {hubs.length > 0 && (
        <nav className="mh-hubs" aria-label="งาน">
          {hubs.map((it, i) => {
            const Icon = iconOf(it);
            const n = countOf(it);
            const tone = HUB_TONES[i % HUB_TONES.length];
            return (
              <Link key={it.key} to={it.href} className="mh-hub" style={{ "--hub-tint": tone.tint, "--hub-hill": tone.hill }}
                aria-label={n ? `${it.title} (${BADGE_LABEL[it.badgeKey] || "ค้าง"} ${n})` : it.title}>
                <span className="mh-hub-title">{labelOf(it)}</span>
                {/* เนินสีสดที่ก้นช่อง + ไอคอนสีในวงกลมขาววางบนเนิน · ตัวเลขค้างติดมุมวงกลม */}
                <span className="mh-hub-hill" aria-hidden="true" />
                <span className="mh-hub-art" aria-hidden="true">
                  <Icon className="mh-hub-icon" style={gradFill(tone.ink)} />
                  {n > 0 && <span className="mh-hub-badge">{countText(n)}</span>}
                </span>
              </Link>
            );
          })}
        </nav>
      )}

      {/* ── 3. เมนูอื่นทั้งหมด — กรอบเดียว แบ่งหมวด ── */}
      {blocks.length > 0 && (
        <nav className="mh-quick" aria-label="เมนูตามหมวด">
          {blocks.map((b) => (b.kind === "full" ? (
            <QuickGroup key={b.group.key} group={b.group} countOf={countOf} />
          ) : (
            <div key={b.groups.map((grp) => grp.key).join("-")} className="mh-qpair">
              {b.groups.map((grp) => <QuickGroup key={grp.key} group={grp} countOf={countOf} half />)}
            </div>
          )))}
        </nav>
      )}

      <div className="mh-band mh-band--end" aria-hidden="true" />
    </div>
  );
}

/** หมวดในกรอบเมนู — ชื่อหมวดเล็ก + ไอคอน (เต็มกรอบ 4 ช่อง · ครึ่งกรอบ 2 ช่อง) */
function QuickGroup({ group, countOf, half = false }) {
  return (
    <section className={`mh-qgroup${half ? " mh-qgroup--half" : ""}`} style={{ "--mh-tone": group.tone }}>
      <h2 className="mh-qlabel">{group.title}</h2>
      <div className="mh-qgrid">
        {group.items.map((it) => <MenuIcon key={it.key} it={it} n={countOf(it)} />)}
      </div>
    </section>
  );
}

function MenuIcon({ it, n }) {
  const Icon = iconOf(it);
  return (
    <Link to={it.href} className="mh-icon-btn" style={{ "--mh-tone": it.tone }}
      aria-label={n ? `${it.title} (${BADGE_LABEL[it.badgeKey] || "ค้าง"} ${n})` : it.title}>
      <span className="mh-icon-wrap">
        <Icon className="mh-icon" aria-hidden="true" style={gradFill(it.tone)} />
        {n > 0 && <span className="mh-badge">{countText(n)}</span>}
      </span>
      <span className="mh-icon-label">{labelOf(it)}</span>
    </Link>
  );
}
