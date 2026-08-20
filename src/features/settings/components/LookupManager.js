import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import {
  Box, Stack, Typography, TextField, IconButton, Button, Skeleton,
} from "@mui/material";
import { Add, Edit, Delete, Check, Close, Search } from "@mui/icons-material";

// ✅ ประเภทงาน/ระบบ มีรูปร่างข้อมูลเหมือนกันเป๊ะ (แค่ชื่อ) — คอมโพเนนต์เดียวใช้ซ้ำได้ทั้งคู่
// แทนการสร้างตาราง MUI แยกกันสองชุดที่โค้ดจะซ้ำกันเกือบทั้งหมด
const LookupManager = ({ title, icon, service, itemLabel }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await service.getAll();
      setItems(res?.items || []);
    } catch (error) {
      Swal.fire("โหลดข้อมูลไม่สำเร็จ", error?.response?.data || error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await service.add(newName.trim());
      setNewName("");
      setAdding(false);
      await fetchItems();
      Swal.fire({ title: `เพิ่ม${itemLabel}แล้ว`, icon: "success", timer: 1200, showConfirmButton: false });
    } catch (error) {
      Swal.fire("เพิ่มไม่สำเร็จ", error?.response?.data || error.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item._id);
    setEditingName(item.name);
  };

  const handleSaveEdit = async (id) => {
    if (!editingName.trim()) return;
    setSaving(true);
    try {
      await service.update(id, editingName.trim());
      setEditingId(null);
      await fetchItems();
      Swal.fire({ title: `แก้ไข${itemLabel}แล้ว`, icon: "success", timer: 1200, showConfirmButton: false });
    } catch (error) {
      Swal.fire("แก้ไขไม่สำเร็จ", error?.response?.data || error.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    const result = await Swal.fire({
      title: "คุณแน่ใจหรือไม่?",
      text: `ต้องการลบ "${item.name}" ออกจากรายการ${itemLabel}ใช่ไหม`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#dc2626",
    });
    if (!result.isConfirmed) return;

    try {
      await service.remove(item._id);
      await fetchItems();
      Swal.fire({ title: `ลบ${itemLabel}แล้ว`, icon: "success", timer: 1200, showConfirmButton: false });
    } catch (error) {
      Swal.fire("ลบไม่สำเร็จ", error?.response?.data || error.message, "error");
    }
  };

  const filteredItems = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Stack direction="row" alignItems="center" gap={1}>
          {icon}
          <Typography fontWeight={800} fontSize="15px" color="#0f172a">{title}</Typography>
          <span style={styles.countBadge}>{items.length}</span>
        </Stack>
        <Button
          size="small"
          startIcon={<Add sx={{ fontSize: 16 }} />}
          onClick={() => setAdding((p) => !p)}
          sx={{
            textTransform: "none", fontWeight: 700, fontSize: "12.5px",
            color: "#dc2626", borderRadius: "8px",
          }}
        >
          เพิ่ม{itemLabel}
        </Button>
      </Stack>

      {adding && (
        <Stack direction="row" gap={1} sx={{ mb: 1.5 }}>
          <TextField
            size="small" fullWidth autoFocus
            placeholder={`ชื่อ${itemLabel}ใหม่`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <IconButton onClick={handleAdd} disabled={saving} sx={{ color: "#10b981" }}><Check /></IconButton>
          <IconButton onClick={() => { setAdding(false); setNewName(""); }} sx={{ color: "#94a3b8" }}><Close /></IconButton>
        </Stack>
      )}

      {items.length > 6 && (
        <TextField
          size="small" fullWidth placeholder={`ค้นหา${itemLabel}...`}
          value={search} onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <Search sx={{ fontSize: 18, color: "#94a3b8", mr: 0.5 }} /> }}
          sx={{ mb: 1.5 }}
        />
      )}

      {loading ? (
        <Stack gap={1}>
          {[1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={44} />)}
        </Stack>
      ) : filteredItems.length === 0 ? (
        <Box sx={styles.empty}>ยังไม่มี{itemLabel}ในระบบ</Box>
      ) : (
        <Stack gap={0.75}>
          {filteredItems.map((item) => (
            <Stack key={item._id} direction="row" alignItems="center" gap={1} sx={styles.row}>
              {editingId === item._id ? (
                <>
                  <TextField
                    size="small" fullWidth autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(item._id)}
                  />
                  <IconButton onClick={() => handleSaveEdit(item._id)} disabled={saving} sx={{ color: "#10b981" }}><Check fontSize="small" /></IconButton>
                  <IconButton onClick={() => setEditingId(null)} sx={{ color: "#94a3b8" }}><Close fontSize="small" /></IconButton>
                </>
              ) : (
                <>
                  <Typography sx={{ flex: 1, fontSize: "13.5px", fontWeight: 500, color: "#334155" }}>{item.name}</Typography>
                  <IconButton size="small" onClick={() => startEdit(item)} sx={{ color: "#64748b" }}><Edit sx={{ fontSize: 17 }} /></IconButton>
                  <IconButton size="small" onClick={() => handleDelete(item)} sx={{ color: "#ef4444" }}><Delete sx={{ fontSize: 17 }} /></IconButton>
                </>
              )}
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  );
};

const styles = {
  countBadge: {
    fontSize: "10px", fontWeight: 700, color: "#dc2626",
    backgroundColor: "rgba(220,38,38,0.08)", borderRadius: "8px", padding: "1px 7px",
  },
  row: {
    padding: "8px 10px", borderRadius: "10px", border: "1px solid #e2e8f0", backgroundColor: "#ffffff",
  },
  empty: {
    padding: "24px 12px", textAlign: "center", fontSize: "12.5px", color: "#94a3b8",
    border: "1px dashed #e2e8f0", borderRadius: "10px",
  },
};

export default LookupManager;
