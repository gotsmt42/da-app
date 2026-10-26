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
import { Link, useSearchParams } from "react-router-dom";
import moment from "moment";
import { Box, Stack, Typography, ButtonBase, Skeleton, IconButton, Tooltip } from "@mui/material";
import { PlaceOutlined, RefreshRounded, TaskAltRounded, ChevronRightRounded, ViewAgendaOutlined, TableRowsOutlined } from "@mui/icons-material";
import AttendanceService from "@/shared/services/AttendanceService";
import AuthService from "@/shared/services/authService";
import useRealtime from "@/shared/realtime/useRealtime";
import { useAuth } from "@/features/auth/AuthContext";
import { can } from "@/shared/utils/roles";
import { refreshAppBadges } from "@/shared/hooks/useAppBadges";
import { formatThai } from "@/shared/utils/thaiDate";
import ThaiDatePicker from "@/shared/components/ThaiDatePicker";
import PersonSelectField from "@/shared/ui/PersonSelectField";
import { PageHeader, EmptyState, INK, INK_2, MUTED, FAINT, PAGE_SX, ICON_BTN_SX } from "@/shared/ui/PageKit";
import { CARD } from "@/shared/ui/modernUi";
import AttendanceList, { AttendanceTable } from "../components/AttendanceList";
import usePaged, { PageBar } from "@/shared/ui/usePaged";
import { ON_SITE_M } from "../attendanceMeta";
import { initialViewMode } from "@/shared/ui/ViewToggle";


const PRESETS = [
  { key: "today", label: "วันนี้", range: () => [moment(), moment()] },
  { key: "7d", label: "7 วัน", range: () => [moment().subtract(6, "days"), moment()] },
  { key: "month", label: "เดือนนี้", range: () => [moment().startOf("month"), moment()] },
  { key: "custom", label: "กำหนดเอง" },
];
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
  const [preset, setPreset] = useState("7d");
  const [from, setFrom] = useState(fmt(moment().subtract(6, "days")));
  const [to, setTo] = useState(fmt(moment()));
  const [person, setPerson] = useState("all");
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
        AttendanceService.list({ from, to, userId: person !== "all" ? person : undefined }),
        isApprover ? AttendanceService.list({ pending: 1 }) : Promise.resolve(null),
      ]);
      setRows(list?.attendance || []);
      setClosedHidden(Number(list?.closedHidden) || 0);
      if (pend) { setPendingRows(pend.attendance || []); setPendingCount(Number(pend.pendingCount) || 0); }
    } catch {
      setRows((p) => p || []);
    }
  }, [from, to, person, isApprover]);
  useEffect(() => { load(); }, [load]);
  useRealtime("attendance", () => { load(); });
  useEffect(() => {
    if (!seeAll) return;
    AuthService.getAllUserData().then((r) => setEmployees(r?.allUser || [])).catch(() => {});
  }, [seeAll]);

  const pickPreset = (key) => {
    setPreset(key);
    const p = PRESETS.find((x) => x.key === key);
    if (!p?.range) return; // กำหนดเอง — ใช้ช่องวันที่ด้านล่าง
    const [a, b] = p.range();
    setFrom(fmt(a));
    setTo(fmt(b));
  };

  const stats = useMemo(() => {
    const list = rows || [];
    return {
      visits: list.length,
      jobs: new Set(list.map((r) => String(r.jobGroupId || r.eventId))).size,
      far: list.filter((r) => r.checkIn?.distanceM != null && r.checkIn.distanceM > ON_SITE_M).length,
      noGps: list.filter((r) => r.checkIn?.gps !== "ok").length,
    };
  }, [rows]);

  // แบ่งหน้า — การ์ด 20 / ตาราง 30 รายการ (จัดกลุ่มตามวันเฉพาะรายการในหน้านั้น)
  const pg = usePaged(rows || [], isTable ? 30 : 20);
  const { setPage } = pg;
  useEffect(() => { setPage(1); }, [from, to, person, isTable, setPage]);
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

  const people = useMemo(() => employees.filter((u) => u.fname).map((u) => ({
    id: String(u._id), name: [u.fname, u.lname].filter(Boolean).join(" "), avatar: u.imageUrl, note: u.jobTitle || undefined,
  })), [employees]);

  const onChanged = (r) => {
    setRows((prev) => (prev || []).map((x) => (x._id === r._id ? r : x)));
    setPendingRows((prev) => (prev || []).map((x) => (x._id === r._id ? r : x)).filter((x) => x.hasPendingCorrection));
    refreshAppBadges();
    load();
  };

  const setTab = (t) => setParams((p) => { const n = new URLSearchParams(p); if (t === "list") n.delete("tab"); else n.set("tab", t); return n; }, { replace: true });

  return (
    // 🔁 (26 ต.ค. 2569) กว้างเท่าหน้าการดำเนินงาน/งานใหม่ — สลับแท็บแล้วขอบไม่กระโดด
    <Box sx={{ ...PAGE_SX, maxWidth: "none" }}>
      <SectionTabs group="operation" />
      <PageHeader
        icon={<PlaceOutlined />}
        title={seeAll ? "ประวัติบันทึกการเข้างาน" : "ประวัติเข้างานของฉัน"}
        subtitle="เวลาเข้างานจากเซิร์ฟเวอร์ · ตำแหน่ง GPS · รูปหน้างาน"
        actions={(
          <>
            {tab === "list" && (
              <Stack direction="row" sx={{ display: { xs: "none", md: "flex" }, p: 0.4, borderRadius: 2.5, border: "1px solid #e2e8f0", bgcolor: "#fff" }}>
                {[["card", ViewAgendaOutlined, "การ์ด"], ["table", TableRowsOutlined, "ตาราง"]].map(([k, Ico, label]) => (
                  <ButtonBase key={k} onClick={() => changeView(k)} aria-label={`มุมมอง${label}`}
                    sx={{ height: 30, px: 1.1, gap: 0.5, borderRadius: 2, fontFamily: "inherit", fontSize: "0.78rem", fontWeight: 800,
                      color: view === k ? "#fff" : "#475569", bgcolor: view === k ? "#2563eb" : "transparent" }}>
                    <Ico sx={{ fontSize: 17 }} />{label}
                  </ButtonBase>
                ))}
              </Stack>
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
            empty={<EmptyState icon={<PlaceOutlined />} title="ไม่มีคำขอแก้เวลาที่รออนุมัติ" />} />
        )
      ) : (
        <>
          {/* ตัวกรอง — ช่วงเวลาเป็นปุ่มสลับแถวเดียว · เลือก "กำหนดเอง" ค่อยมีช่องวันที่ */}
          <Box sx={{ ...CARD, borderRadius: 3, mb: 1.5, p: 1 }}>
            <Stack direction={{ xs: "column", md: "row" }} gap={0.75} alignItems={{ md: "center" }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Segmented value={preset} onChange={pickPreset} items={PRESETS.map((p) => ({ key: p.key, label: p.label }))} />
              </Box>
              {seeAll && (
                <PersonSelectField label="" title="เลือกช่าง" value={person} onChange={setPerson} allLabel="ช่างทุกคน"
                  options={people} sx={{ width: { xs: "100%", md: 240 }, height: 38, borderRadius: "10px" }} />
              )}
            </Stack>
            {preset === "custom" && (
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, mt: 1.25 }}>
                <ThaiDatePicker label="ตั้งแต่" value={from} onChange={(v) => setFrom(v || fmt(moment()))} />
                <ThaiDatePicker label="ถึง" value={to} onChange={(v) => setTo(v || fmt(moment()))} />
              </Box>
            )}
            {/* ✅ (11 ต.ค. 2569 ผู้ใช้: "จำนวนที่นับให้ตัดเหลือที่จำเป็นพอ ให้เหลือแถวเดียว ไม่ให้กินพื้นที่")
                ช่วงวันที่ (ซ้าย) + ตัวเลขสรุปเป็นข้อความบรรทัดเดียว (ขวา) — เหลือ ครั้ง · งาน · ตำแหน่งไม่ตรง */}
            <Stack direction="row" alignItems="baseline" justifyContent="space-between" gap={1} flexWrap="wrap" sx={{ mt: 0.85, px: 0.5 }}>
              <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>
                {preset === "custom" ? "" : from === to ? formatThai(moment(from), "D MMMM YYYY") : `${formatThai(moment(from), "D MMM")} – ${formatThai(moment(to), "D MMM YYYY")}`}
              </Typography>
              {rows?.length > 0 && (
                <Typography sx={{ fontSize: "0.78rem", color: INK_2, whiteSpace: "nowrap" }}>
                  <b style={{ fontWeight: 600 }}>{stats.visits}</b> ครั้ง · <b style={{ fontWeight: 600 }}>{stats.jobs}</b> งาน
                  {stats.far + stats.noGps > 0 && (
                    <Box component="span" sx={{ color: "#b45309" }}> · ตำแหน่งไม่ตรง <b style={{ fontWeight: 600 }}>{stats.far + stats.noGps}</b></Box>
                  )}
                </Typography>
              )}
            </Stack>
          </Box>

          {/* ✅ (11 ต.ค. 2569 ผู้ใช้: "งานไหนเสร็จแล้วให้ดีดออกจากหน้านี้ ไปเก็บในการดำเนินงาน")
              งานที่ปิดแล้วไม่อยู่ในหน้านี้ — บอกจำนวนไว้และพาไปดูที่หน้าการดำเนินงาน (บันทึกเข้า-ออกในการ์ดงาน) */}
          {closedHidden > 0 && (
            <ButtonBase component={Link} to="/operation?group=closed"
              sx={{ width: "100%", mb: 1.5, px: 1.5, py: 1.1, gap: 1, justifyContent: "flex-start", borderRadius: "12px", bgcolor: "#eef2f6", fontFamily: "inherit", textDecoration: "none" }}>
              <TaskAltRounded sx={{ fontSize: 18, color: MUTED }} />
              <Typography sx={{ flex: 1, textAlign: "left", fontSize: "0.8rem", color: INK_2 }}>
                งานที่ปิดแล้ว {closedHidden} รายการ — ดูบันทึกเข้างานได้ที่หน้าการดำเนินงาน
              </Typography>
              <ChevronRightRounded sx={{ fontSize: 20, color: FAINT }} />
            </ButtonBase>
          )}

          {rows === null ? (
            <Stack spacing={1}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={84} />)}</Stack>
          ) : !rows.length ? (
            <EmptyState icon={<PlaceOutlined />} title="ไม่มีบันทึกเข้างานในช่วงนี้" hint="หัวหน้าทีมกดเข้างานได้จากการ์ดงานในหน้า “งานของฉัน”" />
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
          <Typography sx={{ mt: 2, fontSize: "0.72rem", color: MUTED, textAlign: "center" }}>
            🔒 เวลาทั้งหมดบันทึกจากเซิร์ฟเวอร์ แก้จากเครื่องไม่ได้ — การแก้เวลาต้องผ่านการอนุมัติ และเก็บประวัติไว้ทุกครั้ง
            {!seeAll && <><br />อยากแก้เวลา? กดที่รายการแล้วเลือก “ขอแก้เวลา”</>}
          </Typography>
        </>
      )}
    </Box>
  );
}
