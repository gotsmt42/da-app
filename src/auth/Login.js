import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import API from "../API/axiosInstance";

import {
  Box,
  Paper,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Checkbox,
  FormControlLabel,
  Typography,
  CircularProgress,
  Stack,
} from "@mui/material";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";

import { useAuth } from "./AuthContext";

const BRAND_GRADIENT = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";

const FEATURES = [
  { icon: <EventAvailableOutlinedIcon />, label: "จัดการแผนงานและตารางเข้างาน" },
  { icon: <VerifiedUserOutlinedIcon />, label: "ติดตามสถานะการดำเนินงานแบบเรียลไทม์" },
  { icon: <DescriptionOutlinedIcon />, label: "จัดเก็บเอกสารและไฟล์งานครบในที่เดียว" },
];

const Login = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const { login, isLoggedIn } = useAuth();

  useEffect(() => {
    if (isLoggedIn) {
      navigate("/", { replace: true });
    }
  }, [isLoggedIn, navigate]);

  const handleValidation = () => {
    const newErrors = {};
    if (!username) newErrors.username = "กรุณากรอกชื่อผู้ใช้หรืออีเมล";
    if (!password) newErrors.password = "กรุณากรอกรหัสผ่าน";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!handleValidation()) return;

    setLoading(true);
    try {
      const response = await API.post(`/auth/login`, { username, password });

      if (response?.data?.token && response?.data?.payload) {
        const { token, payload } = response.data;
        login(token, payload);

        Swal.fire({
          icon: "success",
          title: "เข้าสู่ระบบสำเร็จ!",
          text: `ยินดีต้อนรับ, ${payload.fname} ${payload.lname}`,
          timer: 1600,
          showConfirmButton: false,
        });

        navigate("/dashboard");
      } else {
        Swal.fire({
          icon: "error",
          title: "เข้าสู่ระบบล้มเหลว",
          text: "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่",
        });
      }
    } catch (error) {
      console.error("🔴 Login failed", error);
      const errMsg =
        error?.response?.data?.err ||
        error?.response?.data?.message ||
        error?.message ||
        "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";

      Swal.fire({ icon: "error", title: "เข้าสู่ระบบล้มเหลว", text: errMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Swal.fire({
      icon: "info",
      title: "ลืมรหัสผ่าน?",
      text: "กรุณาติดต่อผู้ดูแลระบบเพื่อทำการรีเซ็ตรหัสผ่าน",
    });
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: { xs: 2, sm: 3 },
        background:
          "radial-gradient(circle at 15% 15%, #eef1fd 0%, transparent 45%), radial-gradient(circle at 85% 85%, #f3ecfb 0%, transparent 45%), #f4f5f9",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 960,
          display: "flex",
          borderRadius: 4,
          overflow: "hidden",
          boxShadow: "0 24px 60px -20px rgba(76, 60, 150, 0.35)",
        }}
      >
        {/* Left brand panel */}
        <Box
          sx={{
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
            justifyContent: "space-between",
            width: "45%",
            p: 5,
            position: "relative",
            overflow: "hidden",
            background: BRAND_GRADIENT,
            color: "#fff",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              top: -60,
              right: -60,
              width: 220,
              height: 220,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
            }}
          />
          <Box
            sx={{
              position: "absolute",
              bottom: -80,
              left: -60,
              width: 260,
              height: 260,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.06)",
            }}
          />

          <Box sx={{ position: "relative", zIndex: 1 }}>
            <Box
              component="img"
              src="/logo-light-2.png"
              alt="DA App"
              sx={{ height: 40, mb: 5, filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.15))" }}
            />
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1.5, lineHeight: 1.3 }}>
              ระบบบริหารจัดการ
              <br />
              งานบริการภาคสนาม
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.85, maxWidth: 320 }}>
              เชื่อมต่อทีมช่างและฝ่ายบริหารไว้ในที่เดียว บริหารงานได้ง่าย รวดเร็ว และแม่นยำ
            </Typography>
          </Box>

          <Stack spacing={2} sx={{ position: "relative", zIndex: 1 }}>
            {FEATURES.map((f) => (
              <Stack key={f.label} direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 36,
                    height: 36,
                    borderRadius: "10px",
                    background: "rgba(255,255,255,0.15)",
                    flexShrink: 0,
                  }}
                >
                  {f.icon}
                </Box>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  {f.label}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        {/* Right form panel */}
        <Box
          sx={{
            width: { xs: "100%", md: "55%" },
            bgcolor: "background.paper",
            px: { xs: 3, sm: 6 },
            py: { xs: 5, sm: 7 },
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <Box
            component="img"
            src="/logo-dark-2.png"
            alt="DA App"
            sx={{ height: 32, mb: 3, display: { xs: "block", md: "none" } }}
          />

          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            เข้าสู่ระบบ
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            กรอกข้อมูลบัญชีของคุณเพื่อเข้าใช้งานระบบ
          </Typography>

          <Box component="form" onSubmit={handleLogin} noValidate>
            <TextField
              fullWidth
              label="ชื่อผู้ใช้ / อีเมล"
              variant="outlined"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              error={Boolean(errors.username)}
              helperText={errors.username}
              autoComplete="username"
              sx={{ mb: 2.5 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonOutlineIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="รหัสผ่าน"
              type={showPassword ? "text" : "password"}
              variant="outlined"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={Boolean(errors.password)}
              helperText={errors.password}
              autoComplete="current-password"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlinedIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((v) => !v)}
                      edge="end"
                      size="small"
                      tabIndex={-1}
                    >
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mt: 0.5, mb: 3.5 }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                }
                label={<Typography variant="body2">จดจำฉัน</Typography>}
              />
              <Typography
                variant="body2"
                onClick={handleForgotPassword}
                sx={{
                  color: "#667eea",
                  cursor: "pointer",
                  fontWeight: 500,
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                ลืมรหัสผ่าน?
              </Typography>
            </Stack>

            <Button
              type="submit"
              fullWidth
              disabled={loading}
              sx={{
                py: 1.3,
                borderRadius: 2.5,
                color: "#fff",
                fontWeight: 600,
                fontSize: "0.95rem",
                textTransform: "none",
                background: BRAND_GRADIENT,
                boxShadow: "0 10px 25px -8px rgba(102, 126, 234, 0.6)",
                "&:hover": {
                  background: BRAND_GRADIENT,
                  boxShadow: "0 12px 28px -6px rgba(102, 126, 234, 0.75)",
                },
                "&.Mui-disabled": {
                  background: BRAND_GRADIENT,
                  opacity: 0.7,
                  color: "#fff",
                },
              }}
            >
              {loading ? <CircularProgress size={22} sx={{ color: "#fff" }} /> : "เข้าสู่ระบบ"}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default Login;
