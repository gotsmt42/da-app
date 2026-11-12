/**
 * AttendancePage — "เช็คอินเข้างาน" (10 ต.ค. 2569)
 * 🧹 11 ต.ค. 2569 ตัดเช็คเอาต์ออก (ผู้ใช้: ช่างต้องวิ่งหลายงาน ทำงานได้ยาก) — ไม่มี "กำลังทำงาน"/ชั่วโมงทำงานแล้ว
 *
 * แอดมิน/ผู้จัดการ: เห็นบันทึกเช็คอินของช่างทุกคน · จำนวนงาน/ช่าง · ใครเช็คอินห่างหน้างาน
 *                   แท็บ "คำขอแก้เวลา" อนุมัติ/ไม่อนุมัติ (เก็บประวัติทุกครั้ง)
 * ช่าง: เห็นประวัติของตัวเอง (server กรองให้) · ขอแก้เวลาได้จากรายการ
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import SectionTabs from "@/shared/ui/SectionTabs";
import { useSearchParams } from "react-router-dom";
import moment from "moment";
import { Box, Stack, Typography, ButtonBase, Skeleton, IconButton, Tooltip, TextField, InputAdornment } from "@mui/material";
import { SearchRounded } from "@mui/icons-material";
import SelectField from "@/shared/ui/SelectField";
import PeriodFilter from "@/features/operation/components/PeriodFilter";
import { ReportSection, RankRow, TotalRow, Stat, TotalHero, FilterCard, PersonAvatar, R_CARD } from "@/features/operation/components/ReportKit";
import { SHORT_PRESETS, PERIOD_PRESETS, periodRange, periodText } from "@/features/operation/utils/reportPeriod";
import { PlaceRounded, RefreshRounded, ViewAgendaRounded, TableRowsRounded } from "@mui/icons-material";
import AttendanceService from "@/shared/services/AttendanceService";
import AuthService from "@/shared/services/authService";
import useRealtime from "@/shared/realtime/useRealtime";
import { useAuth } from "@/features/auth/AuthContext";
import { can } from "@/shared/utils/roles";
import { refreshAppBadges } from "@/shared/hooks/useAppBadges";
import { formatThai } from "@/shared/utils/thaiDate";
import PersonSelectField from "@/shared/ui/PersonSelectField";
import { PageHeader, EmptyState, INK, INK_2, MUTED, PAGE_SX, ICON_BTN_SX } from "@/shared/ui/PageKit";
import AttendanceList, { AttendanceTable, AttendanceDetailDialog, AttendanceAvatarContext } from "../components/AttendanceList";
import { hasValidAvatar } from "@/shared/utils/user";
import usePaged, { PageBar } from "@/shared/ui/usePaged";
import { ON_SITE_M } from "../attendanceMeta";
import { initialViewMode } from "@/shared/ui/ViewToggle";
import ExportExcelButton from "@/shared/ui/ExportExcelButton";


const fmt = (m) => m.format("YYYY-MM-DD");

/** ปุ่มสลับแบบ segmented control (พื้นเทา · ช่องที่เลือกเป็นการ์ดขาว) */
function Segmented({ items, value, onChange, height = 32 }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 0.4, p: 0.4, borderRadius: "11px", bgcolor: "#eef2f6" }}>
      {items.map(({ key, label, badge }) => {
        const on = value === key;
        return (
          <ButtonBase key={key} onClick={() => onChange(key)}
            sx={{ height, borderRadius: "8px", fontFamily: "inherit", fontSize: "0.8rem", fontWeight: on ? 600 : 500, gap: 0.6, px: 0.5,
              bgcolor: on ? "#fff" : "transparent", color: on ? INK : MUTED, boxShadow: on ? "0 1px 3px rgba(15,23,42,.12)" : "none",
              whiteSpace: "nowrap" }}>
            {label}
            {badge > 0 && (
              <Box component="span" sx={{ minWidth: 20, height: 20, px: 0.6, borderRadius: 99, bgcolor: "#dc2626", color: "#fff", fontSize: "0.7rem", fontWeight: 600, display: "inline-grid", placeItems: "center" }}>{badge}</Box>
            )}
          </ButtonBase>
        );
      })}
    </Box>
  );
}

export default function AttendancePage() {
  const { userData } = useAuth() || {};
  const me = String(userData?.userId || "");
  const seeAll = can(userData, "viewAllJobs") || can(userData, "approveJobs");
  const isApprover = can(userData, "approveJobs");
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "pending" && isApprover ? "pending" : "list";
  // 🔁 (4 พ.ย. 2569 ผู้ใช้: "ประวัติเข้างานด้วยทำให้ละเอียดและชัดเจนสมบูรณ์") ช่วงเวลาชุดเดียวกับหน้ารายงาน (ภาษาไทย)
  // 🔁 (11 พ.ย. 2569 ผู้ใช้: "ให้แสดงเป็นของวันนี้ค่าตั้งต้น") · ลิงก์จากแจ้งเตือน ?date=YYYY-MM-DD = เปิดวันนั้น
  const linkDate = /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") || "") ? params.get("date") : "";
  const [period, setPeriod] = useState(() => ({
    preset: linkDate && linkDate !== fmt(moment()) ? "custom" : "today", month: moment().format("YYYY-MM"), year: moment().format("YYYY"),
    from: linkDate || fmt(moment()), to: linkDate || fmt(moment()),
  }));
  // ✅ (11 พ.ย. 2569 ผู้ใช้: "การแจ้งเตือนให้ลิงก์ให้ตรง เวลามีการบันทึกเข้างาน") ?open=<attendanceId> = เปิดรายละเอียดบันทึกนั้นทันที
  const openParam = params.get("open") || "";
  const [from, to] = periodRange(period.preset, period);
  const [person, setPerson] = useState("all");
  const [q, setQ] = useState("");
  const [place, setPlace] = useState("all"); // all | on | off
  const [includeClosed, setIncludeClosed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [rows, setRows] = useState(null);
  const [pendingRows, setPendingRows] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [employees, setEmployees] = useState([]);
  const [closedHidden, setClosedHidden] = useState(0);
  // ✅ (19 ต.ค. 2569 ผู้ใช้: "ให้มีแสดงแบบตารางด้วย") — จำมุมมองไว้ในเครื่อง · มือถือเป็นการ์ดเสมอ
  const [view, setView] = useState(() => initialViewMode("tt-att-view"));
  const changeView = (v) => { setView(v); try { localStorage.setItem("tt-att-view", v); } catch { /* ignore */ } };
  const isTable = view === "table" && (typeof window === "undefined" || window.innerWidth >= 900);

  const load = useCallback(async () => {
    try {
      const [list, pend] = await Promise.all([
        AttendanceService.list({ from: from || undefined, to: to || undefined, userId: person !== "all" ? person : undefined, includeClosed: includeClosed ? 1 : undefined }),
        isApprover ? AttendanceService.list({ pending: 1 }) : Promise.resolve(null),
      ]);
      setRows(list?.attendance || []);
      setClosedHidden(Number(list?.closedHidden) || 0);
      if (pend) { setPendingRows(pend.attendance || []); setPendingCount(Number(pend.pendingCount) || 0); }
    } catch {
      setRows((p) => p || []);
    }
  }, [from, to, person, isApprover, includeClosed]);
  useEffect(() => { load(); }, [load]);
  /**
   * ✅ (12 พ.ย. 2569 ผู้ใช้: "ข้อมูลอยู่ใน push กดแล้วเจอ แต่กดเข้ารายละเอียดตรงนั้นไม่ได้")
   *    ลิงก์แจ้งเตือน ?open=<id> — เดิมหาเฉพาะในรายการที่โหลดอยู่ (ตัดงานที่ปิดแล้ว/คนที่เลือก/ช่วงวัน) หาไม่เจอ = ไม่เปิดอะไรเลย
   *    → หาไม่เจอในรายการ ดึงวันนั้นใหม่แบบรวมงานที่ปิดแล้ว ทุกคน แล้วเปิดรายละเอียด
   */
  const [linkRow, setLinkRow] = useState(null);
  const listRow = openParam ? (rows || []).find((r) => String(r._id) === openParam) || null : null;
  useEffect(() => {
    if (!openParam || rows === null || listRow) { setLinkRow(null); return; }
    let alive = true;
    const day = linkDate || from || fmt(moment());
    AttendanceService.list({ from: linkDate || from || day, to: linkDate || to || day, includeClosed: 1 })
      .then((r) => { if (alive) setLinkRow((r?.attendance || []).find((x) => String(x._id) === openParam) || null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [openParam, rows, listRow, linkDate, from, to]);
  const openRow = listRow || linkRow;
  useRealtime("attendance", () => { load(); });
  useEffect(() => {
    if (!seeAll) return;
    AuthService.getAllUserData().then((r) => setEmployees(r?.allUser || [])).catch(() => {});
  }, [seeAll]);

  // ตัวกรองฝั่งจอ — ค้นหา (ชื่อ/โครงการ/งาน/เลขที่งาน) · ตำแหน่ง
  const isOff = (r) => r.checkIn?.gps !== "ok" || (r.checkIn?.distanceM != null && r.checkIn.distanceM > ON_SITE_M);
  /**
   * 🔁 (12 พ.ย. 2569 ผู้ใช้: "การกดแสดงผลต่างๆ ยังดูใช้งานไม่ได้ · ข้อมูลให้กระชับและสมบูรณ์")
   *    กล่องตัวเลขทุกกล่องกดกรองรายการได้ (เดิมกดได้แค่ 2 กล่อง และ "ห่างหน้างาน" กรองรวมไม่มี GPS ตัวเลขไม่ตรงรายการ)
   *    · ตัวเลขในกล่องนับจากรายการก่อนกรองตามกล่อง — กดกล่องหนึ่งแล้วกล่องอื่นไม่กลายเป็น 0
   */
  const isFar = (r) => r.checkIn?.gps === "ok" && r.checkIn?.distanceM != null && r.checkIn.distanceM > ON_SITE_M;
  const PLACE_TEST = {
    on: (r) => !isOff(r),
    off: (r) => isOff(r),
    far: isFar,
    gps: (r) => r.checkIn?.gps !== "ok",
    offsched: (r) => Boolean(r.offSchedule),
    pend: (r) => Boolean(r.hasPendingCorrection),
  };
  const base$ = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return (rows || []).filter((r) => !kw || [r.userName, r.job?.site, r.job?.company, r.job?.title, r.job?.system, r.jobLabel, r.jobNo, r.team?.head, ...(r.team?.members || [])]
      .some((v) => String(v || "").toLowerCase().includes(kw)));
  }, [rows, q]);
  const view$ = useMemo(() => (PLACE_TEST[place] ? base$.filter(PLACE_TEST[place]) : base$), [base$, place]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    const list = base$;
    return {
      visits: list.length,
      jobs: new Set(list.map((r) => String(r.jobGroupId || r.eventId))).size,
      people: new Set(list.map((r) => String(r.userId))).size,
      days: new Set(list.map((r) => moment(r.checkIn?.at).format("YYYY-MM-DD"))).size,
      onSite: list.filter((r) => !isOff(r)).length,
      far: list.filter(isFar).length,
      noGps: list.filter((r) => r.checkIn?.gps !== "ok").length,
      pending: list.filter((r) => r.hasPendingCorrection).length,
      offSchedule: list.filter((r) => r.offSchedule).length,
    };
  }, [base$]); // eslint-disable-line react-hooks/exhaustive-deps

  // สรุปรายคน (เรียงตามจำนวนครั้ง)
  const byPerson = useMemo(() => {
    const m = new Map();
    view$.forEach((r) => {
      const k = String(r.userId);
      const x = m.get(k) || { id: k, name: r.userName || "-", visits: 0, jobs: new Set(), days: new Set(), far: 0, last: "" };
      x.visits += 1;
      x.jobs.add(String(r.jobGroupId || r.eventId));
      x.days.add(moment(r.checkIn?.at).format("YYYY-MM-DD"));
      if (isOff(r)) x.far += 1;
      if (String(r.checkIn?.at || "") > x.last) x.last = r.checkIn?.at;
      m.set(k, x);
    });
    return [...m.values()].map((x) => ({ ...x, jobs: x.jobs.size, days: x.days.size })).sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name, "th"));
  }, [view$]);
  const personPg = usePaged(byPerson, 8);

  // แบ่งหน้า — การ์ด 20 / ตาราง 30 รายการ (จัดกลุ่มตามวันเฉพาะรายการในหน้านั้น)
  const pg = usePaged(view$, isTable ? 30 : 20);
  const { setPage } = pg;
  useEffect(() => { setPage(1); }, [from, to, person, isTable, q, place, setPage]);
  const goPage = (n) => { setPage(n); window.scrollTo({ top: 0, behavior: "smooth" }); };

  // จัดกลุ่มตามวันที่เช็คอิน (ใหม่ → เก่า)
  const groups = useMemo(() => {
    const m = new Map();
    pg.rows.forEach((r) => {
      const k = moment(r.checkIn?.at).format("YYYY-MM-DD");
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    });
    return [...m.entries()];
  }, [pg.rows]);

  // รูปโปรไฟล์จริงของแต่ละคน — ใช้ในรายการ/ตาราง/รายละเอียด (รวมรูปตัวเองเมื่อดูได้แค่ของตัวเอง)
  const avatarMap = useMemo(() => {
    const m = new Map(employees.filter((u) => hasValidAvatar(u.imageUrl)).map((u) => [String(u._id), u.imageUrl]));
    if (me && hasValidAvatar(userData?.imageUrl) && !m.has(me)) m.set(me, userData.imageUrl);
    return m;
  }, [employees, me, userData?.imageUrl]);
  const people = useMemo(() => employees.filter((u) => u.fname).map((u) => ({
    id: String(u._id), name: [u.fname, u.lname].filter(Boolean).join(" "), avatar: u.imageUrl, note: u.jobTitle || undefined,
  })), [employees]);

  const onChanged = (r) => {
    setRows((prev) => (prev || []).map((x) => (x._id === r._id ? r : x)));
    setPendingRows((prev) => (prev || []).map((x) => (x._id === r._id ? r : x)).filter((x) => x.hasPendingCorrection));
    refreshAppBadges();
    load();
  };

  const periodLabel = periodText(period.preset, from, to);
  const personName = person !== "all" ? (people.find((p) => p.id === person)?.name || "") : "";
  const filterLabel = [personName ? `ผู้บันทึก: ${personName}` : (seeAll ? "ทุกคน" : ""), q.trim() ? `ค้นหา: ${q.trim()}` : "",
    ({ on: "เฉพาะตรงหน้างาน", off: "เฉพาะตำแหน่งไม่ตรง", far: "เฉพาะห่างหน้างาน", gps: "เฉพาะไม่มี GPS", offsched: "เฉพาะนอกวันที่ลงตาราง", pend: "เฉพาะรอแก้เวลา" })[place] || "", includeClosed ? "รวมงานที่ปิดแล้ว" : ""].filter(Boolean).join(" · ");
  const doExport = async () => {
    setExporting(true);
    try {
      const { exportAttendance } = await import("../utils/attendanceExcel");
      await exportAttendance(view$, byPerson, { periodLabel, filterLabel, fileName: `ประวัติเข้างาน ${periodLabel.replace(/[/\\:*?"<>|]/g, "-")}` });
    } finally {
      setExporting(false);
    }
  };

  const setTab = (t) => setParams((p) => { const n = new URLSearchParams(p); if (t === "list") n.delete("tab"); else n.set("tab", t); return n; }, { replace: true });

  return (
    <AttendanceAvatarContext.Provider value={avatarMap}>
    {/* 🔁 (26 ต.ค. 2569) กว้างเท่าหน้าการดำเนินงาน/งานใหม่ — สลับแท็บแล้วขอบไม่กระโดด */}
    <Box sx={{ ...PAGE_SX, maxWidth: "none" }}>
      <SectionTabs group="operation" />
      <PageHeader
        icon={<PlaceRounded />}
        title={seeAll ? "ประวัติบันทึกการเข้างาน" : "ประวัติเข้างานของฉัน"}
        subtitle="เวลาเข้างานจากเซิร์ฟเวอร์ · ตำแหน่ง GPS · รูปหน้างาน"
        actions={(
          <>
            {tab === "list" && (
              <Stack direction="row" sx={{ display: { xs: "none", md: "flex" }, p: 0.4, borderRadius: 2.5, border: "1px solid #e6e9ef", bgcolor: "#fff" }}>
                {[["card", ViewAgendaRounded, "การ์ด"], ["table", TableRowsRounded, "ตาราง"]].map(([k, Ico, label]) => (
                  <ButtonBase key={k} onClick={() => changeView(k)} aria-label={`มุมมอง${label}`}
                    sx={{ height: 30, px: 1.1, gap: 0.5, borderRadius: 2, fontFamily: "inherit", fontSize: "0.78rem", fontWeight: 800,
                      color: view === k ? "#fff" : "#475569", bgcolor: view === k ? "#2563eb" : "transparent" }}>
                    <Ico sx={{ fontSize: 17 }} />{label}
                  </ButtonBase>
                ))}
              </Stack>
            )}
            {tab === "list" && (
              <ExportExcelButton onClick={doExport} loading={exporting} disabled={!view$.length} count={view$.length} unit="ครั้ง" />
            )}
            <Tooltip title="โหลดใหม่"><IconButton onClick={load} sx={ICON_BTN_SX}><RefreshRounded fontSize="small" /></IconButton></Tooltip>
          </>
        )}
      />

      {/* ✅ (10 ต.ค. 2569 ผู้ใช้: "หน้าเข้าออกงานยังไม่สวย UI ดูยาก ใช้งานยาก — จัดวางให้มืออาชีพ")
          ลำดับใหม่: แท็บ → ช่วงเวลา (ปุ่มสลับแถวเดียว) + ช่าง → ตัวเลข 2×2 → รายการตามวัน */}
      {isApprover && (
        <Box sx={{ mb: 1 }}>
          <Segmented height={34} value={tab} onChange={setTab}
            items={[{ key: "list", label: "รายการเข้างาน" }, { key: "pending", label: "คำขอแก้เวลา", badge: pendingCount }]} />
        </Box>
      )}

      {tab === "pending" ? (
        pendingRows === null ? <Skeleton variant="rounded" height={120} /> : (
          <AttendanceList rows={pendingRows} me={me} isApprover showJob onChanged={onChanged}
            empty={<EmptyState icon={<PlaceRounded />} title="ไม่มีคำขอแก้เวลาที่รออนุมัติ" />} />
        )
      ) : (
        <>
          {/* ── ตัวกรอง ── */}
          <FilterCard footer={`${periodLabel}${filterLabel ? ` · ${filterLabel}` : ""}`}>
            <PeriodFilter value={period} onChange={(patch) => setPeriod((p) => ({ ...p, ...patch }))} presets={[...SHORT_PRESETS, ...PERIOD_PRESETS]} />
            {seeAll && (
              <PersonSelectField label="ผู้บันทึกเข้างาน" title="เลือกช่าง" value={person} onChange={setPerson} allLabel="ทุกคน"
                options={people} sx={{ minWidth: { xs: "100%", md: 230 } }} />
            )}
            <TextField size="small" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา ชื่อช่าง / โครงการ / งาน / เลขที่งาน"
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded sx={{ fontSize: 19, color: MUTED }} /></InputAdornment> }}
              sx={{ flex: 1, minWidth: { md: 240 }, "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "#fff" } }} />
            <SelectField label="ตำแหน่ง" value={place} onChange={(e) => setPlace(e.target.value)} sx={{ minWidth: 150 }}>
              <option value="all">ทุกตำแหน่ง</option>
              <option value="on">ตรงหน้างาน</option>
              <option value="off">ไม่ตรง / ไม่มี GPS</option>
            </SelectField>
            <SelectField label="งานที่ปิดแล้ว" value={includeClosed ? "1" : "0"} onChange={(e) => setIncludeClosed(e.target.value === "1")} sx={{ minWidth: 150 }}>
              <option value="0">ไม่รวม</option>
              <option value="1">รวมงานที่ปิดแล้ว</option>
            </SelectField>
          </FilterCard>

          {/* ── ภาพรวม ── */}
          {rows !== null && (
            <TotalHero
              label={personName ? `บันทึกเข้างานของ ${personName}` : "บันทึกเข้างานทั้งหมด"}
              value={`${stats.visits} ครั้ง`}
              sub={`${periodLabel} · ${stats.jobs} งาน · ${stats.days} วัน${seeAll ? ` · ${stats.people} คน` : ""}`}
              stats={[
                <Stat key="on" label="ตรงหน้างาน" value={`${stats.onSite} ครั้ง`} tone={stats.onSite ? "#059669" : undefined}
                  active={place === "on"} onClick={() => setPlace(place === "on" ? "all" : "on")} />,
                <Stat key="far" label="ห่างหน้างาน" value={`${stats.far} ครั้ง`} tone={stats.far ? "#b45309" : undefined}
                  active={place === "far"} onClick={() => setPlace(place === "far" ? "all" : "far")} />,
                <Stat key="gps" label="ไม่มี GPS" value={`${stats.noGps} ครั้ง`} tone={stats.noGps ? "#b45309" : undefined}
                  active={place === "gps"} onClick={() => setPlace(place === "gps" ? "all" : "gps")} />,
                <Stat key="off" label="นอกวันที่ลงตาราง" value={`${stats.offSchedule} ครั้ง`}
                  active={place === "offsched"} onClick={() => setPlace(place === "offsched" ? "all" : "offsched")} />,
                <Stat key="pend" label="รอแก้เวลา" value={`${stats.pending} ครั้ง`} tone={stats.pending ? "#dc2626" : undefined}
                  active={place === "pend"} onClick={() => setPlace(place === "pend" ? "all" : "pend")} />,
              ]}
              note={!includeClosed && closedHidden > 0
                ? <>ไม่รวมงานที่ปิดแล้ว {closedHidden} ครั้ง — <ButtonBase onClick={() => setIncludeClosed(true)} sx={{ fontFamily: "inherit", fontSize: "inherit", fontWeight: 800, color: "#2563eb", verticalAlign: "baseline" }}>แสดงด้วย</ButtonBase></>
                : `ตรงหน้างาน = ห่างจากพิกัดหน้างานไม่เกิน ${ON_SITE_M} ม. · เวลาทั้งหมดจากเซิร์ฟเวอร์`}
            />
          )}

          {/* 🔁 (11 พ.ย. 2569 ผู้ใช้: "เอารายการเข้างานมาแสดงให้ชัดเจน สลับตำแหน่งกับสรุปรายคน") */}
          <Typography sx={{ fontWeight: 800, fontSize: { xs: "1.18rem", sm: "1.3rem" }, color: INK, mb: 1.25, px: { xs: 0.5, sm: 0 } }}>
            รายการเข้างาน <Box component="span" sx={{ fontSize: "0.86rem", fontWeight: 600, color: MUTED }}>{view$.length} ครั้ง</Box>
          </Typography>

          {rows === null ? (
            <Stack spacing={1}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={84} />)}</Stack>
          ) : !view$.length ? (
            <EmptyState icon={<PlaceRounded />} title="ไม่มีบันทึกเข้างานในช่วงนี้" hint="ทุกคนในทีม (หัวหน้าทีม + ลูกทีม) กดบันทึกเข้างานของตัวเองจากการ์ดงานในหน้า “งานของฉัน”" />
          ) : isTable ? (
            <>
              <AttendanceTable rows={pg.rows} me={me} isApprover={isApprover} onChanged={onChanged} />
              <PageBar {...pg} setPage={goPage} unit="ครั้ง" />
            </>
          ) : (
            <>
            <Stack spacing={2.25}>
              {groups.map(([day, list]) => (
                <Box key={day}>
                  <Stack direction="row" alignItems="baseline" justifyContent="space-between" gap={1} sx={{ mb: 0.85, px: 0.5 }}>
                    <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK_2 }}>{formatThai(moment(day), "dddd D MMM YYYY")}</Typography>
                    <Typography sx={{ fontSize: "0.76rem", color: MUTED, whiteSpace: "nowrap" }}>
                      {list.length} ครั้ง
                    </Typography>
                  </Stack>
                  <AttendanceList rows={list} me={me} isApprover={isApprover} showJob onChanged={onChanged} />
                </Box>
              ))}
            </Stack>
            <PageBar {...pg} setPage={goPage} unit="ครั้ง" />
            </>
          )}

          {/* ── สรุปรายคน ── */}
          <Box sx={{ mt: 2.5 }} />
          {seeAll && person === "all" && byPerson.length > 1 && (
            <ReportSection title="สรุปรายคน" hint="เรียงตามจำนวนครั้งที่เข้างาน · กดชื่อเพื่อดูเฉพาะคนนั้น">
              <Box sx={R_CARD}>
                {personPg.rows.map((p, i) => (
                  <RankRow key={p.id} rank={(personPg.page - 1) * personPg.size + i + 1}
                    leading={<PersonAvatar name={p.name} avatar={people.find((x) => x.id === p.id)?.avatar} />}
                    title={p.name}
                    sub={`${p.jobs} งาน · ${p.days} วัน · ล่าสุด ${p.last ? formatThai(moment(p.last), "D MMM YY HH:mm") : "-"}`}
                    value={`${p.visits} ครั้ง`}
                    valueSub={p.far ? <span style={{ color: "#b45309", fontWeight: 700 }}>ตำแหน่งไม่ตรง {p.far}</span> : "ตรงหน้างานทุกครั้ง"}
                    onClick={() => setPerson(p.id)} />
                ))}
                <TotalRow label={`รวม ${byPerson.length} คน`} value={`${stats.visits} ครั้ง`} valueSub={`${stats.jobs} งาน`} />
              </Box>
              <PageBar {...personPg} unit="คน" />
            </ReportSection>
          )}

          <AttendanceDetailDialog
            row={openRow}
            onClose={() => { const p = new URLSearchParams(params); p.delete("open"); setParams(p, { replace: true }); }}
            me={me} isApprover={isApprover} onChanged={onChanged} />
          <Typography sx={{ mt: 2, fontSize: "0.72rem", color: MUTED, textAlign: "center" }}>
            🔒 เวลาทั้งหมดบันทึกจากเซิร์ฟเวอร์ แก้จากเครื่องไม่ได้ — การแก้เวลาต้องผ่านการอนุมัติ และเก็บประวัติไว้ทุกครั้ง
            {!seeAll && <><br />อยากแก้เวลา? กดที่รายการแล้วเลือก “ขอแก้เวลา”</>}
          </Typography>
        </>
      )}
    </Box>
    </AttendanceAvatarContext.Provider>
  );
}
