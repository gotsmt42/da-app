/**
 * DispatchRequestDialog — ฟอร์มแจ้งงานจากแผนกอื่นมาให้ฝ่ายช่าง
 *
 * ⚠️ ผู้แจ้ง (เซล) ไม่ได้เป็นคนเลือกช่างหรือกำหนดวันเอง — เขาไม่รู้ว่าคิวช่างว่างวันไหน
 * แอดมิน/ผู้จัดการเป็นคนตรวจแล้วจัดลงแผนงานให้ (ดู ReviewDialog.js) ฟอร์มนี้จึงมีหน้าที่เดียว:
 * เก็บข้อมูลให้ครบพอที่ช่างจะไปทำงานได้โดยไม่ต้องโทรกลับมาถาม
 *
 * 🧹 ตัดออกตามที่ผู้ใช้สั่ง:
 *   • "กำหนดเสร็จ" — ผู้แจ้งกำหนดวันเสร็จไม่ได้อยู่ดี คนกำหนดคือคนจัดคิว การให้กรอกไว้ทำให้เกิด
 *     ความคาดหวังที่ระบบไม่ได้ผูกพันอะไรด้วยเลย
 *   • "สิ่งที่ต้องทำ" + "ของที่ต้องเตรียม" (รายการติ๊กทีละข้อ) — แทนด้วย "หมายเหตุเพิ่มเติม"
 *     ช่องเดียว เพราะของจริงคนแจ้งเป็นเซล ไม่ได้รู้ขั้นตอนหน้างานดีกว่าช่าง การบังคับให้แจกแจง
 *     เป็นข้อๆ ได้ผลลัพธ์เป็นรายการว่างเปล่าเสียส่วนใหญ่
 *
 * ✅ เพิ่ม: ลิงก์ตำแหน่งจริงบน Google Maps — ที่อยู่ที่พิมพ์เป็นตัวหนังสือพาช่างไปผิดที่ได้บ่อยมาก
 */
import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, Typography,
  TextField, IconButton, Chip, Alert, useMediaQuery, ToggleButton, ToggleButtonGroup,
  Tooltip, InputAdornment, Autocomplete,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  AttachFile, Close, Assignment, OpenInNew, NoteAlt, Send,
  Lock, Description as DescriptionIcon,
} from "@mui/icons-material";

import { formatBytes } from "@/shared/utils/fileUpload";
import CustomerService from "@/shared/services/CustomerService";
import EventService from "@/shared/services/EventService";
import { DEPARTMENT } from "@/shared/utils/roles";
import { mapSearchUrl, GoogleMapsPin } from "@/shared/ui/SiteMapLink";
import JobTypeService from "@/shared/services/JobTypeService";
import SystemTypeService from "@/shared/services/SystemTypeService";
import DispatchService from "../services/DispatchService";
import {
  DISPATCH_ACCENT, TEXT_SUB, BORDER_MAIN,
  DOC_TYPE_META,
  DOC_TYPE_ORDER,
} from "../dispatchMeta";

const empty = () => ({
  title: "", detail: "", system: "", note: "",
  company: "", site: "", address: "", mapUrl: "",
  contactName: "", contactTel: "",
  priority: "normal",
  // ✅ ผูกกับสัญญาที่มีอยู่จริง — ว่าง = งานทั่วไป (ดูโหมด "งานตามสัญญา" ในฟอร์ม)
  contractGroupId: "",
});

/**
 * ช่องที่ค่ามาจากสัญญา แก้เองไม่ได้
 * ⚠️ ต้องล็อกจริงๆ ไม่ใช่แค่เติมค่าให้แล้วปล่อยแก้ได้ — บริษัท/โครงการที่เพี้ยนไปแม้แต่ตัวเดียวจะทำให้
 * งานหลุดออกจากสัญญากลายเป็นคนละกลุ่มทันที (เหตุผลเดียวกับที่ฟอร์มของช่างใช้ select แบบเลือกอย่างเดียว)
 */
const LockedField = ({ label, value }) => (
  <TextField
    size="small" label={label} value={value || "—"} fullWidth
    InputProps={{
      readOnly: true,
      endAdornment: (
        <InputAdornment position="end">
          <Tooltip title="ค่านี้มาจากสัญญาที่เลือก แก้ที่นี่ไม่ได้">
            <Lock sx={{ fontSize: 15, color: TEXT_SUB }} />
          </Tooltip>
        </InputAdornment>
      ),
    }}
    sx={{ "& .MuiOutlinedInput-root": { bgcolor: alpha("#64748b", 0.06) } }}
  />
);

/**
 * การ์ดครอบแต่ละกลุ่มของฟอร์ม
 * ✅ เดิมทั้งฟอร์มเป็นช่องกรอกเรียงต่อกันยาวๆ คั่นด้วยหัวข้อตัวเล็กๆ — มองไม่ออกว่าอะไรเป็นชุดเดียวกัน
 * และไม่รู้ว่าเหลืออีกกี่กลุ่ม การครอบเป็นการ์ดที่มีสีประจำกลุ่มทำให้กวาดสายตาทีเดียวเห็นโครงทั้งใบ
 */
/**
 * ✅ ที่แก้ (ผู้ใช้แจ้งว่า "ดูรกตามาก"): เดิมการ์ดแต่ละกลุ่มมีสีประจำตัว (งานส้ม · หน้างานฟ้า ·
 * เอกสารเขียว · หมายเหตุม่วง) ทั้งขอบ พื้นหัวการ์ด และเส้นคั่น — เปิดฟอร์มมาเจอ 4 สีพร้อมกัน
 * ทั้งที่สีไม่ได้สื่ออะไร และแข่งกับช่องกรอกซึ่งเป็นสิ่งที่ต้องโฟกัสจริง
 * ✅ การ์ดขาวขอบเทาเหมือนกันหมด เหลือสีที่ไอคอนดวงเดียว — ชุดเดียวกับ DispatchDialog
 */
const Section = ({ icon, title, hint, accent, children, sx }) => (
  <Box
    sx={{
      border: "1px solid", borderColor: BORDER_MAIN, borderRadius: 2.5,
      overflow: "hidden", bgcolor: "#fff", ...sx,
    }}
  >
    <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.5, pt: 1.25, pb: 0.5 }}>
      <Box sx={{ color: accent, display: "flex" }}>{icon}</Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: "0.82rem", lineHeight: 1.3, color: "#0f172a" }}>{title}</Typography>
        {hint && <Typography variant="caption" sx={{ color: TEXT_SUB }}>{hint}</Typography>}
      </Box>
    </Stack>
    <Box sx={{ px: 1.5, pb: 1.5, pt: 1 }}>{children}</Box>
  </Box>
);

/**
 * ช่องแบบ "เลือกจากที่มีอยู่ หรือพิมพ์ใหม่" — ชุดเดียวกับที่ฟอร์มของช่างใช้ (TomSelect create:true)
 *
 * ⚠️ ต้องเป็น freeSolo เสมอ ห้ามบังคับให้เลือกจากลิสต์อย่างเดียว — ลูกค้า/ระบบ/ประเภทงานใหม่ๆ
 * เกิดขึ้นตลอดเวลา ถ้าบังคับเลือก คนแจ้งจะติดตรงนี้แล้วไปกรอกมั่วในช่องอื่นแทน
 * ⚠️ onInputChange (ไม่ใช่ onChange) เป็นตัวเก็บค่า — onChange ยิงเฉพาะตอนเลือกจากลิสต์
 * ถ้าพึ่งตัวเดียว ค่าที่พิมพ์เองจะหายทั้งหมดตอนกดส่ง
 */
const ComboField = ({ label, required, value, onChange, options, placeholder, helperText }) => (
  <Autocomplete
    freeSolo autoHighlight selectOnFocus handleHomeEndKeys
    options={options}
    // ⚠️ คุมด้วย inputValue ทางเดียว ไม่ส่ง value เข้าไปด้วย —
    // 🐛 ถ้าส่งทั้ง value และ onInputChange โดยไม่ส่ง inputValue, MUI จะรีเซ็ตข้อความในช่องกลับ
    // เป็น getOptionLabel(value) ทุกครั้งที่ value เปลี่ยน ซึ่งเกิดขึ้นทุกตัวอักษรที่พิมพ์ ผลคือ
    // รายการที่กรองไว้กระพริบหาย/เลือกไม่ได้ (เจอตอนพิมพ์ค้นหาชื่อบริษัทแล้วลิสต์ไม่ขึ้นเลย)
    inputValue={value}
    onInputChange={(_, v) => onChange(v || "")}
    renderInput={(params) => (
      <TextField
        {...params} size="small" label={label} required={required}
        placeholder={placeholder} helperText={helperText}
        FormHelperTextProps={{ sx: { fontSize: "0.68rem", mx: 0 } }}
      />
    )}
  />
);

export default function DispatchRequestDialog({ open = true, onClose, onCreated }) {
  const isMobile = useMediaQuery("(max-width:900px)");
  const [form, setForm] = useState(empty);
  const [files, setFiles] = useState([]);
  // ชนิดเอกสารที่จะติดให้ไฟล์ชุดถัดไปที่เลือก — เริ่มที่ใบเสนอราคาเพราะเป็นเอกสารที่แนบบ่อยที่สุด
  const [nextDocType, setNextDocType] = useState("quotation");
  // ✅ ตัวเลือกจากตารางกลางชุดเดียวกับฟอร์มของช่าง — ค่าที่แจ้งมาจะถูกเอาไปสร้างเป็นแผนงานจริง
  // ตอนอนุมัติ ถ้าปล่อยให้พิมพ์อิสระล้วนๆ ชื่อโครงการ/ระบบจะสะกดไม่ตรงกับที่มีอยู่แล้วในระบบ
  // ทำให้กรองงานตามโครงการหรือระบบไม่เจอในภายหลัง
  const [customers, setCustomers] = useState([]);
  const [jobTypes, setJobTypes] = useState([]);
  const [systems, setSystems] = useState([]);
  // ✅ งานทั่วไป vs งานตามสัญญา — ขั้นตอนแรกเดียวกับฟอร์มของช่าง (ดู AddEvent.js "ขั้นตอนที่ 1")
  const [jobMode, setJobMode] = useState("general");
  const [contracts, setContracts] = useState([]);
  const [contractsLoading, setContractsLoading] = useState(true);
  const [pickedContract, setPickedContract] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [warn, setWarn] = useState("");

  // ⚠️ ล้างฟอร์มทุกครั้งที่เปิด — ไม่งั้นแจ้งงานใบที่ 2 จะเห็นข้อมูลของใบแรกค้างอยู่แล้วส่งซ้ำได้ง่ายมาก
  useEffect(() => {
    if (!open) return;
    setError(""); setWarn(""); setFiles([]); setNextDocType("quotation");
    setJobMode("general"); setPickedContract(null);
    setForm(empty());
  }, [open]);

  // ⚠️ โหลดครั้งเดียวตอน mount ไม่ใช่ทุกครั้งที่เปิด — รายการพวกนี้แทบไม่เปลี่ยนระหว่างเซสชัน
  // และการยิง 3 request ทุกครั้งที่กดเปิดฟอร์มทำให้กล่องเปิดช้าโดยไม่ได้อะไรเพิ่ม
  useEffect(() => {
    let alive = true;
    Promise.all([
      CustomerService.getCustomers().catch(() => ({ userCustomers: [] })),
      JobTypeService.getAll().catch(() => ({ items: [] })),
      SystemTypeService.getAll().catch(() => ({ items: [] })),
      // ✅ สัญญาที่ยังเพิ่มครั้งได้ — ต้องส่ง dept: service เพราะผู้แจ้งเป็นฝ่ายขาย กำลังขอดูข้าม
      // แผนกมาฝั่งช่าง (สิทธิ์ viewServiceCalendar) ถ้าไม่ส่งจะได้รายการว่างเสมอ
      EventService.getContracts({ dept: DEPARTMENT.SERVICE }).catch(() => ({ contracts: [] })),
    ]).then(([c, j, sy, ct]) => {
      if (!alive) return;
      setCustomers(c?.userCustomers || []);
      setJobTypes([...new Set((j?.items || []).map((t) => t.name).filter(Boolean))].sort());
      setSystems([...new Set((sy?.items || []).map((t) => t.name).filter(Boolean))].sort());
      setContracts(ct?.contracts || []);
      setContractsLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const companyOptions = useMemo(
    () => [...new Set(customers.map((c) => c.cCompany).filter(Boolean))].sort(),
    [customers]
  );

  // ⚠️ โครงการต้องกรองตามบริษัทที่เลือกไว้ — บริษัทเดียวมีหลายสาขา และชื่อสาขาซ้ำกันข้ามบริษัทได้
  // (เช่น "สำนักงานใหญ่") ถ้าโชว์รวมทุกบริษัทจะเลือกผิดได้ง่ายมาก · ยังไม่เลือกบริษัท = โชว์ทั้งหมด
  const siteOptions = useMemo(() => {
    const pool = form.company
      ? customers.filter((c) => c.cCompany === form.company)
      : customers;
    return [...new Set(pool.map((c) => c.cSite).filter(Boolean))].sort();
  }, [customers, form.company]);

  /**
   * ✅ เลือกลูกค้า/โครงการที่มีอยู่แล้ว = เติมที่อยู่และผู้ติดต่อให้อัตโนมัติ
   * ข้อมูลพวกนี้อยู่ในทะเบียนลูกค้าอยู่แล้ว การให้พิมพ์ซ้ำคือการเปิดโอกาสให้พิมพ์ผิด
   * ⚠️ เติมเฉพาะช่องที่ยังว่าง ไม่ทับของที่คนกรอกไว้เอง — หน้างานเดียวกันอาจมีผู้ติดต่อคนละคน
   * กับที่อยู่ในทะเบียน และคนแจ้งเป็นคนที่รู้ดีกว่าในกรณีนั้น
   */
  const applyCustomer = (company, site) => {
    const hit = customers.find((c) => c.cCompany === company && c.cSite === site);
    if (!hit) return;
    setForm((f) => ({
      ...f,
      address: f.address || hit.address || "",
      contactName: f.contactName || hit.cName || "",
      contactTel: f.contactTel || hit.tel || "",
      // ✅ พิกัดที่เคยบันทึกไว้กับโครงการนี้ — โครงการเดิมอยู่ที่เดิมเสมอ ไม่ต้องไปหาลิงก์ใหม่ทุกครั้ง
      mapUrl: f.mapUrl || hit.mapUrl || "",
    }));
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const contractLabel = (c) =>
    [c.company, c.site].filter(Boolean).join(" · ") || "(ไม่ระบุชื่อ)";

  /**
   * เลือกสัญญา = ยึดข้อมูลระบุตัวงานจากสัญญาทั้งชุด (บริษัท/โครงการ/ประเภทงาน/ระบบ)
   * ⚠️ ทับของเดิมทั้งหมด ไม่ใช่เติมเฉพาะช่องว่าง (ต่างจาก applyCustomer ด้านบนโดยตั้งใจ) —
   * ครั้งถัดไปของสัญญาต้องเป็น "งานเดียวกันกับครั้งก่อนๆ" เป๊ะ ถ้าปล่อยให้ต่างได้ก็ไม่ใช่สัญญาเดียวกัน
   */
  const pickContract = (c) => {
    setPickedContract(c);
    if (!c) {
      setForm((f) => ({ ...f, contractGroupId: "" }));
      return;
    }
    setForm((f) => ({
      ...f,
      contractGroupId: c.key,
      company: c.company || "",
      site: c.site || "",
      title: c.title || "",
      system: c.system || "",
    }));
  };

  /** สลับโหมด — ออกจากโหมดสัญญาต้องล้างการผูกทิ้ง ไม่งั้นใบจะยังผูกสัญญาอยู่ทั้งที่จอไม่โชว์แล้ว */
  const changeMode = (mode) => {
    if (!mode || mode === jobMode) return;
    setJobMode(mode);
    setError("");
    if (mode === "general") {
      setPickedContract(null);
      setForm((f) => ({ ...f, contractGroupId: "" }));
    }
  };

  const isContractMode = jobMode === "contract";

  // ⚠️ ตรวจแค่ว่าเป็น URL ที่เปิดได้ไหม ไม่บังคับว่าต้องเป็นโดเมน Google — ลิงก์ย่อ (maps.app.goo.gl)
  // และแอปแผนที่อื่นก็พาไปที่ถูกต้องเหมือนกัน การบล็อกโดเมนอื่นสร้างปัญหามากกว่าที่แก้
  const mapUrlValid = (() => {
    const v = form.mapUrl.trim();
    if (!v) return null;
    try { return ["http:", "https:"].includes(new URL(v).protocol); } catch { return false; }
  })();

  const submit = async () => {
    if (isContractMode && !form.contractGroupId) return setError("กรุณาเลือกสัญญาที่ต้องการเพิ่มครั้งถัดไป");
    if (!form.title.trim()) return setError("กรุณาระบุประเภทงาน");
    if (!form.site.trim()) return setError("กรุณาระบุโครงการ / สาขา");
    if (mapUrlValid === false) return setError("ลิงก์แผนที่ไม่ถูกต้อง — ต้องขึ้นต้นด้วย http:// หรือ https://");
    setSaving(true); setError(""); setWarn("");
    try {
      const { dispatch, rejected } = await DispatchService.create({ ...form, files });
      // ⚠️ ไฟล์ที่ถูกปฏิเสธต้องบอกให้รู้ ไม่ใช่เงียบหายไป — คนส่งจะคิดว่าแนบไปแล้ว
      if (rejected?.length) {
        setWarn(`ส่งคำขอสำเร็จ แต่มี ${rejected.length} ไฟล์ที่แนบไม่ได้: ${rejected.map((r) => `${r.name} (${r.message})`).join(", ")}`);
        setTimeout(() => onCreated?.(dispatch), 3500);
      } else {
        onCreated?.(dispatch);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "ส่งคำขอไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const urgent = form.priority === "urgent";

  return (
    <Dialog open onClose={() => !saving && onClose?.()} fullWidth maxWidth="md" fullScreen={isMobile}>
      <DialogTitle sx={{ pb: 1.25 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: "1rem", color: "#0f172a" }}>แจ้งงานให้ฝ่ายช่าง</Typography>
          <Typography variant="caption" sx={{ color: TEXT_SUB }}>
            กรอกให้ครบ ช่างจะได้ไม่ต้องโทรกลับมาถาม · แอดมินจะตรวจแล้วจัดคิวให้
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ bgcolor: "#f8fafc" }}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
        {warn && <Alert severity="warning" sx={{ mb: 2 }}>{warn}</Alert>}

        {/* ✅ "งานด่วนไหม" ถูกยกขึ้นมาเป็นแถบเต็มความกว้างบนสุด ไม่ใช่ปุ่มเล็กๆ ที่ซ่อนอยู่ข้างช่องวันที่
            เหมือนเดิม — เป็นข้อมูลชิ้นเดียวในใบที่เปลี่ยนลำดับความสำคัญของทั้งคิว คนตรวจต้องเห็นทันที
            และคนแจ้งต้องกดได้โดยไม่ต้องมองหา */}
        {/* ✅ แถวความเร่งด่วนแบบเรียบ — เดิมเป็นกล่องมีขอบ+พื้นสีแดงตอนเลือก "ด่วน" ซึ่งกินพื้นที่
            เต็มความกว้างเหนือฟอร์มทั้งที่เป็นตัวเลือกเดียว */}
        <Stack
          direction="row" alignItems="center" spacing={1.5}
          sx={{ mb: 2, px: 0.25 }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: "0.82rem", color: urgent ? "#dc2626" : "#0f172a" }}>
              ความเร่งด่วน
            </Typography>
            <Typography variant="caption" sx={{ color: TEXT_SUB }}>
              {urgent ? "จะถูกดันขึ้นหัวคิว และแจ้งเตือนหัวหน้าทันที" : "เข้าคิวตามปกติ"}
            </Typography>
          </Box>
          <ToggleButtonGroup
            exclusive size="small" value={form.priority}
            onChange={(_, v) => v && setForm((f) => ({ ...f, priority: v }))}
            sx={{ flexShrink: 0, bgcolor: "#fff" }}
          >
            <ToggleButton value="normal" sx={{ textTransform: "none", fontWeight: 700, px: 2 }}>ปกติ</ToggleButton>
            <ToggleButton
              value="urgent"
              sx={{ textTransform: "none", fontWeight: 800, px: 2, "&.Mui-selected": { bgcolor: "#ef4444", color: "#fff", "&:hover": { bgcolor: "#dc2626" } } }}
            >
              ด่วน
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2, alignItems: "start" }}>
          {/* ── ซ้าย: งาน + หน้างาน ──────────────────────────────────── */}
          <Box sx={{ minWidth: 0, display: "grid", gap: 2 }}>
            <Section
              icon={<Assignment sx={{ fontSize: 18 }} />}
              title="งานที่ต้องทำ"
              hint="ช่างอ่านจากตรงนี้เป็นหลัก"
              accent={DISPATCH_ACCENT}
              sx={{ bgcolor: "#fff" }}
            >
              <Stack spacing={1.25}>
                {/* ── ขั้นตอนที่ 1: งานทั่วไป หรือ ครั้งถัดไปของสัญญา ──────────────────
                    ✅ ที่เพิ่ม (ผู้ใช้ขอ: "ถ้าจะลงงานสัญญา ให้เอาสัญญาที่มีอยู่จริงมาเลือกแบบของช่าง"):
                    เดิมใบแจ้งงานจากเซลถูกสร้างเป็นงานทั่วไปเสมอ งานที่จริงๆ เป็นครั้งที่ N ของสัญญา
                    จึงหลุดออกจากสัญญาไปเป็นงานลอย — นับครั้งไม่ตรงและไม่โผล่ในหน้า "ภาพรวมงาน"
                    ⚠️ วางเป็นขั้นตอนแรกสุดเหมือนของช่าง เพราะเป็นตัวตัดสินว่าช่องที่เหลือต้องกรอกเอง
                    หรือมาจากสัญญา ถ้าไปวางทีหลังคนจะกรอกไปแล้วค่อยโดนทับ */}
                <ToggleButtonGroup
                  exclusive fullWidth size="small" value={jobMode}
                  onChange={(_, v) => changeMode(v)}
                  sx={{
                    "& .MuiToggleButton-root": {
                      textTransform: "none", fontWeight: 700, py: 0.85, lineHeight: 1.3,
                      flexDirection: "column", gap: 0.15,
                    },
                    "& .Mui-selected": {
                      bgcolor: alpha(DISPATCH_ACCENT, 0.16) + " !important",
                      color: "#b45309",
                      borderColor: alpha(DISPATCH_ACCENT, 0.5) + " !important",
                    },
                  }}
                >
                  <ToggleButton value="general">
                    งานทั่วไป
                    <Typography component="span" variant="caption" sx={{ color: TEXT_SUB, fontWeight: 600 }}>
                      งานครั้งเดียว ไม่ผูกสัญญา
                    </Typography>
                  </ToggleButton>
                  <ToggleButton value="contract">
                    งานตามสัญญา
                    <Typography component="span" variant="caption" sx={{ color: TEXT_SUB, fontWeight: 600 }}>
                      ครั้งถัดไปของสัญญาที่มีอยู่
                    </Typography>
                  </ToggleButton>
                </ToggleButtonGroup>

                {isContractMode && (
                  <>
                    {/* ⚠️ เลือกได้อย่างเดียว พิมพ์เพิ่มเองไม่ได้ (ไม่มี freeSolo ต่างจากช่องอื่นในฟอร์มนี้)
                        — สัญญาต้องเป็นตัวที่มีอยู่จริงเท่านั้น พิมพ์เองแล้วสะกดต่างแม้ตัวเดียวจะกลาย
                        เป็นสัญญาคนละฉบับทันที (เหตุผลเดียวกับ create:false ในฟอร์มของช่าง) */}
                    <Autocomplete
                      options={contracts}
                      loading={contractsLoading}
                      value={pickedContract}
                      onChange={(_, v) => pickContract(v)}
                      getOptionLabel={(c) =>
                        contractLabel(c) + " · " + (c.title || "") + " (" + (c.contractNo || "ไม่มีเลขที่") + ")"
                      }
                      isOptionEqualToValue={(o, v) => o.key === v?.key}
                      noOptionsText={contractsLoading ? "กำลังโหลดสัญญา..." : "ไม่มีสัญญาที่ยังเพิ่มครั้งได้"}
                      renderOption={(props, c) => {
                        const { key, ...rest } = props;
                        return (
                          <Box component="li" key={key} {...rest} sx={{ display: "block !important", py: 1 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: "0.83rem", lineHeight: 1.35 }}>
                              {contractLabel(c)}
                            </Typography>
                            <Stack direction="row" spacing={0.6} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.35 }}>
                              <Chip
                                size="small" label={c.contractNo || "ไม่มีเลขที่"}
                                sx={{ height: 17, fontSize: "0.6rem", fontWeight: 700, bgcolor: alpha(DISPATCH_ACCENT, 0.14), color: "#b45309" }}
                              />
                              {c.title && <Typography variant="caption" sx={{ color: TEXT_SUB }}>{c.title}</Typography>}
                              {c.system && <Typography variant="caption" sx={{ color: TEXT_SUB }}>· {c.system}</Typography>}
                              <Box sx={{ flex: 1 }} />
                              {/* จำนวนครั้งที่เหลือ — ตัวเลขที่ตัดสินใจได้ทันทีว่าสัญญานี้ยังใส่งานได้ไหม */}
                              <Typography variant="caption" sx={{ fontWeight: 800, color: "#0891b2" }}>
                                เหลือ {(c.visitCount || 0) - (c.usedVisits || 0)}/{c.visitCount || 0} ครั้ง
                              </Typography>
                            </Stack>
                          </Box>
                        );
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params} size="small" label="เลือกสัญญา" required
                          placeholder="ค้นหาจากชื่อโครงการ / เลขที่สัญญา"
                          helperText={
                            !contractsLoading && contracts.length === 0
                              ? "ยังไม่มีสัญญาที่เพิ่มครั้งได้ — สร้างสัญญาใหม่ได้ที่หน้า ภาพรวมงาน"
                              : "ครั้งที่จะถูกกำหนดให้อัตโนมัติตอนแอดมินอนุมัติ"
                          }
                          FormHelperTextProps={{ sx: { fontSize: "0.68rem", mx: 0 } }}
                        />
                      )}
                    />

                    {/* สรุปสัญญาที่เลือก — ยืนยันให้เห็นชัดว่ากำลังต่อครั้งที่เท่าไรของฉบับไหน */}
                    {pickedContract && (
                      <Box
                        sx={{
                          p: 1.25, borderRadius: 2,
                          bgcolor: alpha("#0891b2", 0.06),
                          border: "1px solid", borderColor: alpha("#0891b2", 0.28),
                        }}
                      >
                        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
                          <DescriptionIcon sx={{ fontSize: 15, color: "#0e7490" }} />
                          <Typography sx={{ fontWeight: 800, fontSize: "0.78rem", color: "#0e7490", flex: 1, minWidth: 0 }} noWrap>
                            {contractLabel(pickedContract)}
                          </Typography>
                          <Chip
                            size="small"
                            label={"จะเป็นครั้งที่ " + (pickedContract.nextRound || "-") + "/" + (pickedContract.visitCount || 0)}
                            sx={{ height: 19, fontSize: "0.63rem", fontWeight: 800, bgcolor: "#0891b2", color: "#fff" }}
                          />
                        </Stack>
                        <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block" }}>
                          เลขที่ {pickedContract.contractNo || "—"} · ลงไปแล้ว {pickedContract.usedVisits || 0} จาก {pickedContract.visitCount || 0} ครั้ง
                          {pickedContract.responsiblePerson ? " · ผู้รับผิดชอบ " + pickedContract.responsiblePerson : ""}
                        </Typography>
                      </Box>
                    )}
                  </>
                )}

                {/* ⚠️ ตรงกับช่อง "ประเภทงาน" ในฟอร์มของช่าง (ทั้งคู่ลงที่ event.title) —
                    ต้องใช้คำเดียวกันและดึงจากตารางเดียวกัน ไม่งั้นงานที่มาจากเซลจะมีชื่อประเภท
                    คนละชุดกับงานที่ช่างสร้างเอง แล้วกรองรวมกันไม่ได้
                    ⚠️ โหมดสัญญาล็อกไว้ — ครั้งถัดไปต้องเป็นงานประเภท/ระบบเดียวกับครั้งก่อนๆ
                    (ฟอร์มของช่างในโหมดสัญญาก็ไม่ให้แก้สองช่องนี้เหมือนกัน) */}
                {isContractMode ? (
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <LockedField label="ประเภทงาน" value={form.title} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <LockedField label="ระบบ" value={form.system} />
                    </Box>
                  </Stack>
                ) : (
                  <>
                    <ComboField
                      label="ประเภทงาน" required value={form.title}
                      onChange={(v) => setForm((f) => ({ ...f, title: v }))}
                      options={jobTypes}
                      placeholder="เลือกหรือพิมพ์ประเภทงาน"
                    />
                    <ComboField
                      label="ระบบ" value={form.system}
                      onChange={(v) => setForm((f) => ({ ...f, system: v }))}
                      options={systems}
                      placeholder="เลือกหรือพิมพ์ชื่อระบบ"
                    />
                  </>
                )}
                <TextField
                  size="small" label="รายละเอียดงาน" value={form.detail} onChange={set("detail")}
                  multiline minRows={3}
                  placeholder="อธิบายสิ่งที่ต้องทำ สภาพหน้างาน หรือสิ่งที่ลูกค้าขอ"
                />
              </Stack>
            </Section>

            <Section
              icon={<GoogleMapsPin size={18} />}
              title="หน้างาน"
              hint="ช่างใช้ไปให้ถูกที่และติดต่อได้"
              accent="#0891b2"
              sx={{ bgcolor: "#fff" }}
            >
              <Stack spacing={1.25}>
                {/* ✅ ที่แก้ (ผู้ใช้ขอ: "แก้ไขฟอร์มการแจ้งงาน ให้บังคับต้องกรอก จากบริษัท เป็นโครงการ"):
                    เดิมบังคับ "ลูกค้า / บริษัท" — สลับมาบังคับ "โครงการ / สาขา" แทน เพราะช่างใช้ชื่อ
                    โครงการเป็นหลักในการไปถึงหน้างานจริง ลูกค้าบางรายไม่มีชื่อบริษัทที่ชัดเจน (บ้านเดี่ยว/
                    นิติบุคคลอาคารชุด) แต่มีชื่อโครงการเสมอ — ย้ายมาไว้ช่องแรกด้วย เพราะเป็นช่องบังคับ
                    ควรอยู่จุดที่สายตาเจอก่อน เข้าชุดกับฟอร์มนัดหมายเซลในปฏิทินที่สลับ required แบบ
                    เดียวกันไปแล้ว */}
                {/* ⚠️ โหมดสัญญาล็อกสองช่องนี้ — บริษัท/โครงการคือสิ่งที่ระบุว่า "เป็นสัญญาฉบับไหน"
                    ถ้าปล่อยให้แก้ได้ ครั้งใหม่จะหลุดออกจากกลุ่มสัญญาเดิมทันทีโดยไม่มีอะไรเตือน */}
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    {isContractMode ? (
                      <LockedField label="โครงการ / สาขา" value={form.site} />
                    ) : (
                    <ComboField
                      label="โครงการ / สาขา" required value={form.site}
                      onChange={(v) => { setForm((f) => ({ ...f, site: v })); applyCustomer(form.company, v); }}
                      options={siteOptions}
                      placeholder="เลือกหรือพิมพ์ชื่อโครงการ"
                    />
                    )}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    {isContractMode ? (
                      <LockedField label="ลูกค้า / บริษัท" value={form.company} />
                    ) : (
                    <ComboField
                      label="ลูกค้า / บริษัท" value={form.company}
                      onChange={(v) => setForm((f) => ({ ...f, company: v }))}
                      options={companyOptions}
                      placeholder="เลือกหรือพิมพ์ชื่อลูกค้า"
                    />
                    )}
                  </Box>
                </Stack>
                <TextField size="small" label="ที่อยู่หน้างาน" value={form.address} onChange={set("address")} multiline maxRows={3} />

                {/* ✅ ลิงก์แผนที่ — ที่อยู่ที่พิมพ์เป็นตัวหนังสือพาช่างไปผิดที่ได้บ่อยมาก
                    (ชื่อโครงการซ้ำกัน ซอยแยกย่อย ตึกไม่มีเลขที่) พิกัดจริงคือสิ่งเดียวที่ไม่กำกวม
                    ✅ ที่เพิ่ม (ผู้ใช้ขอ: "กดลิงก์เปิด google map เพื่อหาตำแหน่ง แล้วแอดลงระบบง่ายๆ"):
                    ปุ่มค้นหาที่เปิด Google Maps พร้อมคำค้นจากชื่อโครงการ/บริษัท/ที่อยู่ที่กรอกไว้แล้ว
                    — เดิมต้องออกจากฟอร์มไปเปิดแอปเอง พิมพ์ชื่อโครงการซ้ำอีกรอบ แล้วค่อยกลับมาวาง */}
                {(form.site || form.company || form.address) && (
                  <Button
                    size="small" variant="outlined"
                    component="a" target="_blank" rel="noopener noreferrer"
                    // ⚠️ ค้นด้วย "ชื่อโครงการ" อย่างเดียวตามที่ผู้ใช้สั่ง — ต่อชื่อบริษัท/ที่อยู่เข้าไปด้วย
                    // ทำให้ Google Maps หาไม่เจอบ่อย (ชื่อนิติบุคคลไม่ใช่ชื่อที่ปักหมุดบนแผนที่)
                    href={mapSearchUrl(form.site, form.company)}
                    startIcon={<GoogleMapsPin size={16} />}
                    endIcon={<OpenInNew sx={{ fontSize: 13 }} />}
                    sx={{
                      textTransform: "none", fontWeight: 600, borderRadius: 2, alignSelf: "flex-start",
                      color: "#0e7490", borderColor: alpha("#0891b2", 0.4),
                      "&:hover": { borderColor: "#0891b2", bgcolor: alpha("#0891b2", 0.06) },
                    }}
                  >
                    ค้นหาตำแหน่งใน Google Maps
                  </Button>
                )}
                <TextField
                  size="small" label="ลิงก์ Google Maps" value={form.mapUrl} onChange={set("mapUrl")}
                  placeholder="วางลิงก์ที่แชร์จากแอป Google Maps"
                  error={mapUrlValid === false}
                  helperText={
                    mapUrlValid === false
                      ? "ลิงก์ไม่ถูกต้อง — ต้องขึ้นต้นด้วย http:// หรือ https://"
                      : "กดปุ่มค้นหาด้านบน → เจอตำแหน่งแล้วกด แชร์ → คัดลอกลิงก์ → วางที่ช่องนี้"
                  }
                  FormHelperTextProps={{ sx: { fontSize: "0.68rem", mx: 0 } }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <GoogleMapsPin size={16} />
                      </InputAdornment>
                    ),
                    // ปุ่มลองเปิดดู — กันเคสวางลิงก์ผิดอันแล้วไม่มีใครรู้จนช่างไปถึงหน้างาน
                    endAdornment: mapUrlValid ? (
                      <InputAdornment position="end">
                        <Tooltip title="ลองเปิดดูว่าตำแหน่งถูกไหม">
                          <IconButton
                            size="small" component="a" href={form.mapUrl.trim()}
                            target="_blank" rel="noopener noreferrer"
                            sx={{ color: "#059669" }}
                          >
                            <OpenInNew sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ) : null,
                  }}
                />

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                  <TextField size="small" fullWidth label="ผู้ติดต่อหน้างาน" value={form.contactName} onChange={set("contactName")} />
                  <TextField size="small" fullWidth label="เบอร์โทร" value={form.contactTel} onChange={set("contactTel")} />
                </Stack>
              </Stack>
            </Section>
          </Box>

          {/* ── ขวา: เอกสาร + หมายเหตุ ───────────────────────────────── */}
          <Box sx={{ minWidth: 0, display: "grid", gap: 2 }}>
            <Section
              icon={<AttachFile sx={{ fontSize: 18 }} />}
              title="เอกสารประกอบ"
              hint="ใบเสนอราคา / ใบ PO เป็นหลักฐานว่างานนี้ปิดการขายแล้ว"
              accent="#059669"
              sx={{ bgcolor: "#fff" }}
            >
              {/* ✅ เลือก "ชนิดเอกสาร" ก่อนแนบ แล้วไฟล์ที่เลือกถัดไปจะได้ป้ายนี้ติดไปด้วย
                  🐛 เดิมไฟล์ทุกใบเป็นก้อนเดียวกันหมด ช่างต้องเดาจากชื่อไฟล์ว่าอันไหนคือใบ PO
                  ซึ่งชื่อไฟล์จากมือถือมักเป็น IMG_0142.jpg ที่ไม่บอกอะไรเลย */}
              <Stack direction="row" spacing={0.5} sx={{ mb: 1.25, flexWrap: "wrap", gap: 0.5 }}>
                {DOC_TYPE_ORDER.map((k) => {
                  const m = DOC_TYPE_META[k];
                  const on = nextDocType === k;
                  return (
                    <Chip
                      key={k} size="small" clickable label={m.label}
                      onClick={() => setNextDocType(k)}
                      sx={{
                        height: 25, fontSize: "0.7rem", fontWeight: 700,
                        bgcolor: on ? m.color : alpha(m.color, 0.1),
                        color: on ? "#fff" : m.color,
                        "&:hover": { bgcolor: on ? m.color : alpha(m.color, 0.22) },
                      }}
                    />
                  );
                })}
              </Stack>

              <Button
                fullWidth size="small" startIcon={<AttachFile sx={{ fontSize: 16 }} />}
                onClick={() => document.getElementById("dispatch-files-input")?.click()}
                sx={{
                  textTransform: "none", fontWeight: 700, borderRadius: 2, py: 1,
                  color: DOC_TYPE_META[nextDocType].color,
                  border: "1.5px dashed", borderColor: alpha(DOC_TYPE_META[nextDocType].color, 0.5),
                  bgcolor: alpha(DOC_TYPE_META[nextDocType].color, 0.04),
                  "&:hover": {
                    borderColor: DOC_TYPE_META[nextDocType].color,
                    bgcolor: alpha(DOC_TYPE_META[nextDocType].color, 0.1),
                  },
                }}
              >
                {`แนบ${DOC_TYPE_META[nextDocType].label}`}
              </Button>
              <input
                id="dispatch-files-input" hidden type="file" multiple accept="image/*,application/pdf"
                onChange={(e) => {
                  const picked = Array.from(e.target.files || []);
                  e.target.value = "";
                  setFiles((p) => [...p, ...picked.map((f) => ({ file: f, docType: nextDocType }))].slice(0, 10));
                }}
              />

              {files.length > 0 ? (
                <Stack spacing={0.5} sx={{ mt: 1.25 }}>
                  {files.map((entry, i) => {
                    const m = DOC_TYPE_META[entry.docType] || DOC_TYPE_META.other;
                    return (
                      <Stack
                        key={i} direction="row" alignItems="center" spacing={1}
                        sx={{ px: 1, py: 0.6, borderRadius: 1.5, bgcolor: alpha(m.color, 0.07), border: "1px solid", borderColor: alpha(m.color, 0.25) }}
                      >
                        <Chip
                          size="small" label={m.short}
                          sx={{ height: 18, minWidth: 34, fontSize: "0.62rem", fontWeight: 800, bgcolor: m.color, color: "#fff", "& .MuiChip-label": { px: 0.6 } }}
                        />
                        <Typography variant="body2" sx={{ flex: 1, minWidth: 0, fontSize: "0.78rem" }} noWrap>{entry.file.name}</Typography>
                        <Typography variant="caption" sx={{ color: TEXT_SUB, flexShrink: 0 }}>{formatBytes(entry.file.size)}</Typography>
                        <IconButton size="small" onClick={() => setFiles((p) => p.filter((_, x) => x !== i))}>
                          <Close sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Stack>
                    );
                  })}
                  <Typography variant="caption" sx={{ color: TEXT_SUB, mt: 0.25 }}>
                    แนบแล้ว {files.length}/10 ไฟล์
                  </Typography>
                </Stack>
              ) : (
                <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", mt: 1 }}>
                  ยังไม่ได้แนบไฟล์ — เลือกชนิดเอกสารด้านบนก่อน แล้วกดปุ่มแนบ
                </Typography>
              )}
            </Section>

            <Section
              icon={<NoteAlt sx={{ fontSize: 18 }} />}
              title="หมายเหตุเพิ่มเติม"
              hint="สิ่งที่ช่างควรรู้ก่อนไป (ไม่บังคับ)"
              accent="#8b5cf6"
              sx={{ bgcolor: "#fff" }}
            >
              <TextField
                fullWidth size="small" multiline minRows={6}
                value={form.note} onChange={set("note")}
                placeholder={"เช่น\n• เข้าได้เฉพาะ จ.–ศ. 9:00–17:00\n• ต้องแลกบัตรที่ป้อมยาม\n• ลูกค้าขอให้โทรก่อนเข้า 30 นาที"}
              />
            </Section>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        {/* ⚠️ จอมือถือ: ปุ่มยืนยันต้องกว้างและอยู่ขวาสุดแบบแอปมือถือ ส่วน "ยกเลิก" เป็นตัวรอง */}
        <Button onClick={() => onClose?.()} disabled={saving} sx={{ textTransform: "none", color: TEXT_SUB }}>ยกเลิก</Button>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="contained" onClick={submit} disabled={saving}
          startIcon={<Send sx={{ fontSize: 17 }} />}
          sx={{
            textTransform: "none", fontWeight: 800, borderRadius: 2, px: 3,
            bgcolor: DISPATCH_ACCENT, "&:hover": { bgcolor: "#d97706" },
          }}
        >
          {saving ? "กำลังส่ง..." : "ส่งให้ฝ่ายช่าง"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
