/**
 * BankAccountPicker — เลือก/เพิ่ม "บัญชีรับเงิน" ของผู้เบิก สำหรับใบเคลมและใบสำรองจ่าย
 *
 * ✅ ผู้ใช้ขอ: "ใบเคลมให้สามารถเพิ่ม และเลือกบัญชีธนาคารให้กับผู้เบิกได้" + "ระบุชื่อ และบัญชีธนาคาร
 * สำหรับโอนคืน" — เดิมฝ่ายบัญชีต้องไปถามเลขบัญชีเป็นรายคนทุกครั้งที่จะโอนจ่ายคืน หรืออ่านจากหมายเหตุ
 * ที่พิมพ์มือ (พิมพ์ผิดง่าย + โอนผิดบัญชีตามเงินคืนยากมาก) ตอนนี้กรอกครั้งเดียวเก็บเป็นทะเบียนของคนนั้น
 * แล้วเลือกซ้ำได้ทุกใบ และเลขที่เลือกจะถูกพิมพ์ลงใบ PDF ให้เลย
 *
 * ⚠️ ทะเบียนบัญชีเป็นข้อมูลส่วนตัว — เจ้าของกับแอดมิน/ผู้จัดการเท่านั้นที่เรียกดูได้ (server บังคับ)
 *    หน้านี้จึงต้องไม่พยายามโหลดบัญชีของคนอื่นเมื่อผู้ใช้ไม่มีสิทธิ์ (ดู canManage)
 * ⚠️ ใบที่บันทึกแล้วเก็บ "สำเนา" ของบัญชี (Expense.payTo) — ลบบัญชีในทะเบียนแล้วใบเก่ายังแสดงเลขเดิม
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box, Stack, Typography, TextField, MenuItem, Button, IconButton, Radio, Chip, Alert,
  CircularProgress, Tooltip, Collapse, Checkbox, FormControlLabel,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { AccountBalance, Add, Close, DeleteOutline, StarOutline, Star } from "@mui/icons-material";

import ExpenseService, { errorText } from "../services/ExpenseService";
import BankLogo from "./BankLogo";
import { BANKS, bankMeta, digitsOnly, formatAccountNo, validateAccount } from "../bankMeta";
import { TEXT_MAIN, TEXT_SUB, BORDER_MAIN, SURFACE_SUBTLE } from "../expenseMeta";

const NONE = "";

const blankForm = (accountName = "") => ({ bankCode: "", accountNo: "", accountName, isDefault: false });

/**
 * @param {string} userId       เจ้าของบัญชี (= ผู้เบิกของใบ)
 * @param {string} ownerName    ชื่อ-นามสกุลผู้เบิก — เติมเป็นชื่อบัญชีให้ตอนเพิ่มบัญชีใหม่
 * @param {string} value        accountId ที่เลือกอยู่ ("" = ไม่ระบุ/รับเงินสด · undefined = ยังไม่ได้เลือก)
 * @param {(accountId: string, account: object|null) => void} onChange
 * @param {boolean} autoSelectDefault  ใบใหม่: เลือกบัญชีหลักให้อัตโนมัติเมื่อผู้ใช้ยังไม่ได้เลือกเอง
 * @param {object} [snapshot]   payTo ที่บันทึกไว้ในใบ (ตอนแก้ไขใบเดิม) — ใช้บอกเมื่อบัญชีนั้นถูกลบไปแล้ว
 */
export default function BankAccountPicker({
  userId, ownerName = "", value, onChange, accent = "#7c3aed", canManage = true, disabled = false,
  autoSelectDefault = false, snapshot = null,
}) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    if (!userId || !canManage) { setAccounts([]); return; }
    setLoading(true); setError("");
    try {
      const { accounts: rows } = await ExpenseService.bankAccounts(userId);
      setAccounts(rows);
    } catch (err) {
      setError(errorText(err, "โหลดบัญชีรับเงินไม่สำเร็จ"));
    } finally {
      setLoading(false);
    }
  }, [userId, canManage]);

  useEffect(() => { load(); }, [load]);

  // ✅ ใบใหม่: เลือกบัญชีหลักให้เลย — คนส่วนใหญ่มีบัญชีเดียวและใช้ซ้ำทุกใบ ไม่ควรต้องกดทุกครั้ง
  // ⚠️ เฉพาะตอนที่ยังไม่มีการเลือก (value === undefined) — ผู้ใช้เลือก "ไม่ระบุ" ("") ไว้ต้องไม่ถูกเขียนทับ
  useEffect(() => {
    if (!autoSelectDefault || value !== undefined || !accounts.length) return;
    const pick = accounts.find((a) => a.isDefault) || accounts[0];
    if (pick) onChange?.(pick._id, pick);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- เลือกให้ครั้งเดียวตอนรายการโหลดเสร็จ
  }, [accounts, autoSelectDefault, value]);

  const selectedId = value === undefined ? "" : value;
  const selected = useMemo(() => accounts.find((a) => a._id === selectedId) || null, [accounts, selectedId]);
  /** บัญชีที่ใบเก่าเลือกไว้แต่ถูกลบออกจากทะเบียนแล้ว — ต้องบอก ไม่ใช่เงียบๆ แล้วใบกลายเป็น "ไม่ระบุ" */
  const snapshotMissing = Boolean(snapshot?.accountId) && snapshot.accountId === selectedId && !selected && !loading && canManage;

  const pick = (id) => {
    if (disabled) return;
    onChange?.(id, accounts.find((a) => a._id === id) || null);
  };

  const openAdd = () => {
    setForm(blankForm(ownerName));
    setFormError("");
    setAdding(true);
  };

  const submitAdd = async () => {
    const invalid = validateAccount(form.bankCode, form.accountNo);
    if (invalid) { setFormError(invalid); return; }
    if (!String(form.accountName).trim()) { setFormError("กรุณากรอกชื่อบัญชี (ชื่อที่ปรากฏในสมุดบัญชี)"); return; }
    setSaving(true); setFormError("");
    try {
      const acc = await ExpenseService.addBankAccount({
        userId,
        bankCode: form.bankCode,
        accountNo: digitsOnly(form.accountNo),
        accountName: String(form.accountName).trim(),
        isDefault: form.isDefault,
      });
      // ✅ เพิ่มเสร็จเลือกให้ทันที — คนกดเพิ่มบัญชีตอนกรอกใบ ก็เพราะจะใช้บัญชีนั้นกับใบนี้
      setAccounts((cur) => [acc, ...cur.map((a) => (acc.isDefault ? { ...a, isDefault: false } : a))]);
      onChange?.(acc._id, acc);
      setAdding(false);
    } catch (err) {
      setFormError(errorText(err, "เพิ่มบัญชีไม่สำเร็จ"));
    } finally {
      setSaving(false);
    }
  };

  const setDefault = async (acc) => {
    setBusyId(acc._id);
    try {
      await ExpenseService.updateBankAccount(acc._id, { isDefault: true });
      setAccounts((cur) => cur.map((a) => ({ ...a, isDefault: a._id === acc._id })));
    } catch (err) {
      setError(errorText(err, "ตั้งบัญชีหลักไม่สำเร็จ"));
    } finally {
      setBusyId("");
    }
  };

  const remove = async (acc) => {
    // ⚠️ ลบบัญชีคือการแก้ทะเบียนถาวร (ไม่ใช่แค่ยกเลิกเลือกในใบนี้) — ต้องถามก่อนเสมอ
    const ok = window.confirm(
      `ลบบัญชี ${bankMeta(acc.bankCode).short} ${formatAccountNo(acc.accountNo)} ออกจากทะเบียน?\nใบเคลมที่เคยเลือกบัญชีนี้ไว้แล้วยังแสดงเลขเดิมตามปกติ`
    );
    if (!ok) return;
    setBusyId(acc._id);
    try {
      await ExpenseService.deleteBankAccount(acc._id);
      setAccounts((cur) => cur.filter((a) => a._id !== acc._id));
      if (selectedId === acc._id) onChange?.(NONE, null);
    } catch (err) {
      setError(errorText(err, "ลบบัญชีไม่สำเร็จ"));
    } finally {
      setBusyId("");
    }
  };

  // ── ไม่มีสิทธิ์ดูทะเบียนของคนอื่น (เช่นหัวหน้าทีมออกใบเคลมจากใบ Advance ของคนอื่น) ──
  if (!canManage) {
    return snapshot?.accountNo ? (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1.25, border: `1px solid ${BORDER_MAIN}`, borderRadius: 2, bgcolor: SURFACE_SUBTLE }}>
        <AccountBalance sx={{ fontSize: 18, color: TEXT_SUB }} />
        <Typography sx={{ fontSize: "0.85rem", fontWeight: 700 }}>
          {snapshot.bankName} {formatAccountNo(snapshot.accountNo)} · {snapshot.accountName}
        </Typography>
      </Stack>
    ) : (
      <Typography variant="caption" sx={{ color: TEXT_SUB }}>
        บัญชีรับเงินของผู้เบิกจะถูกระบุโดยผู้เบิกเองหรือฝ่ายบัญชี
      </Typography>
    );
  }

  const rowSx = (active) => ({
    display: "flex", alignItems: "center", gap: 1, p: 1, pl: 0.5,
    border: `1px solid ${active ? accent : BORDER_MAIN}`, borderRadius: 2,
    bgcolor: active ? alpha(accent, 0.06) : "#fff",
    cursor: disabled ? "default" : "pointer",
    transition: "border-color .15s, background-color .15s",
  });

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 1, borderRadius: 2, fontSize: "0.82rem" }} onClose={() => setError("")}>{error}</Alert>}
      {snapshotMissing && (
        <Alert severity="warning" sx={{ mb: 1, borderRadius: 2, fontSize: "0.82rem" }}>
          บัญชีที่เคยเลือกไว้ในใบนี้ ({snapshot.bankName} {formatAccountNo(snapshot.accountNo)}) ถูกลบออกจากทะเบียนแล้ว — กรุณาเลือกบัญชีใหม่
        </Alert>
      )}

      {loading ? (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="caption" sx={{ color: TEXT_SUB }}>กำลังโหลดบัญชี...</Typography>
        </Stack>
      ) : (
        <Stack spacing={0.75}>
          {accounts.map((a) => {
            const bank = bankMeta(a.bankCode);
            const active = a._id === selectedId;
            return (
              <Box key={a._id} sx={rowSx(active)} onClick={() => pick(a._id)}>
                <Radio size="small" checked={active} disabled={disabled} sx={{ color: TEXT_SUB, "&.Mui-checked": { color: accent } }} />
                <BankLogo code={a.bankCode} size={36} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {/* เลขบัญชีเป็นตัวเด่นที่สุดในแถว — เป็นตัวที่คนอ่านซ้ำตอนโอนเงิน ส่วนชื่อธนาคารดูจากสีป้ายก็รู้แล้ว */}
                  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography sx={{ fontSize: "0.95rem", fontWeight: 800, letterSpacing: 0.3, color: TEXT_MAIN }}>
                      {formatAccountNo(a.accountNo)}
                    </Typography>
                    {a.isDefault && <Chip size="small" label="บัญชีหลัก" sx={{ height: 18, fontSize: "0.66rem", fontWeight: 700, bgcolor: alpha(accent, 0.12), color: accent }} />}
                  </Stack>
                  <Typography variant="caption" sx={{ color: bank.color, fontWeight: 800, display: "block", lineHeight: 1.35 }} noWrap>
                    {bank.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", lineHeight: 1.35 }} noWrap>ชื่อบัญชี {a.accountName}</Typography>
                </Box>
                {busyId === a._id ? <CircularProgress size={16} /> : (
                  <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
                    {a.isDefault ? (
                      <Star sx={{ fontSize: 17, color: accent, m: 0.75 }} />
                    ) : (
                      <Tooltip title="ตั้งเป็นบัญชีหลัก" describeChild>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDefault(a); }}>
                          <StarOutline sx={{ fontSize: 17, color: TEXT_SUB }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="ลบบัญชีนี้ออกจากทะเบียน" describeChild>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); remove(a); }}>
                        <DeleteOutline sx={{ fontSize: 17, color: TEXT_SUB }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                )}
              </Box>
            );
          })}

          {/* ไม่ระบุบัญชี — ยังมีคนรับเป็นเงินสดที่ออฟฟิศ บังคับเลือกบัญชีไม่ได้ */}
          <Box sx={rowSx(!selectedId)} onClick={() => pick(NONE)}>
            <Radio size="small" checked={!selectedId} disabled={disabled} sx={{ color: TEXT_SUB, "&.Mui-checked": { color: accent } }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: TEXT_MAIN }}>ไม่ระบุบัญชี (รับเป็นเงินสด)</Typography>
              <Typography variant="caption" sx={{ color: TEXT_SUB }}>ฝ่ายบัญชีจะติดต่อผู้เบิกเอง</Typography>
            </Box>
          </Box>
        </Stack>
      )}

      {!adding && !disabled && (
        <Button size="small" startIcon={<Add />} onClick={openAdd}
          sx={{ mt: 1, textTransform: "none", fontWeight: 700, color: accent }}>
          เพิ่มบัญชีธนาคาร
        </Button>
      )}

      <Collapse in={adding} unmountOnExit>
        <Box sx={{ mt: 1, p: 1.5, border: `1px dashed ${alpha(accent, 0.5)}`, borderRadius: 2, bgcolor: SURFACE_SUBTLE }}>
          <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: "0.86rem", color: TEXT_MAIN, flex: 1 }}>
              เพิ่มบัญชีของ {ownerName || "ผู้เบิก"}
            </Typography>
            <IconButton size="small" onClick={() => setAdding(false)}><Close fontSize="small" /></IconButton>
          </Stack>
          {formError && <Alert severity="error" sx={{ mb: 1, borderRadius: 2, fontSize: "0.8rem" }}>{formError}</Alert>}
          <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
            {/* ✅ สัญลักษณ์ธนาคารทั้งในรายการที่เลือกได้และในช่องที่เลือกแล้ว — เห็นสีก็รู้ทันทีว่าเลือกถูกธนาคารไหม */}
            <TextField select size="small" label="ธนาคาร *" value={form.bankCode}
              onChange={(e) => setForm((f) => ({ ...f, bankCode: e.target.value }))}
              SelectProps={{
                renderValue: (code) => (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <BankLogo code={code} size={22} />
                    <Box component="span" sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {bankMeta(code).name}
                    </Box>
                  </Stack>
                ),
                MenuProps: { PaperProps: { sx: { maxHeight: 360 } } },
              }}>
              {BANKS.map((b) => (
                <MenuItem key={b.code} value={b.code} sx={{ gap: 1.25, py: 0.85 }}>
                  <BankLogo code={b.code} size={26} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, lineHeight: 1.25 }}>{b.short}</Typography>
                    <Typography variant="caption" sx={{ color: TEXT_SUB, display: "block", lineHeight: 1.25 }}>{b.name}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </TextField>
            <TextField size="small" label="เลขบัญชี *" value={form.accountNo}
              onChange={(e) => setForm((f) => ({ ...f, accountNo: digitsOnly(e.target.value) }))}
              inputProps={{ inputMode: "numeric", maxLength: 13 }}
              placeholder={form.bankCode === "PROMPTPAY" ? "เบอร์มือถือ หรือเลขบัตรประชาชน" : "ตัวเลขเท่านั้น ไม่ต้องใส่ขีด"}
              helperText={form.bankCode ? `ต้องมี ${bankMeta(form.bankCode).digits.join(" หรือ ")} หลัก` : " "} />
            <TextField size="small" label="ชื่อบัญชี *" value={form.accountName}
              onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))}
              inputProps={{ maxLength: 120 }} sx={{ gridColumn: { sm: "1 / -1" } }}
              helperText="ชื่อที่ปรากฏในสมุดบัญชี — ฝ่ายบัญชีใช้ตรวจก่อนโอน ต้องตรงกับหน้าบัญชีจริง" />
          </Box>
          <Stack direction="row" alignItems="center" flexWrap="wrap" sx={{ mt: 0.5 }}>
            <FormControlLabel
              control={<Checkbox size="small" checked={form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} sx={{ "&.Mui-checked": { color: accent } }} />}
              label={<Typography sx={{ fontSize: "0.82rem" }}>ตั้งเป็นบัญชีหลัก (เลือกให้อัตโนมัติในใบถัดไป)</Typography>}
            />
            <Box sx={{ flex: 1 }} />
            <Button size="small" onClick={() => setAdding(false)} sx={{ textTransform: "none", color: TEXT_SUB }}>ยกเลิก</Button>
            <Button size="small" variant="contained" disabled={saving} onClick={submitAdd}
              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Add />}
              sx={{ textTransform: "none", fontWeight: 800, bgcolor: accent, "&:hover": { bgcolor: accent } }}>
              บันทึกบัญชี
            </Button>
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );
}
