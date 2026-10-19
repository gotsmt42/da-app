package com.tidtam.app;

import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Android 15+ บังคับแอปวาดเต็มจอ (edge-to-edge) → หัวแอปไปทับนาฬิกา/แบตเตอรี่ และแถบล่างทับปุ่มนำทาง
 * แก้ที่นี่: ดันหน้าเว็บลงมาใต้แถบสถานะ / เหนือแถบนำทาง / เหนือคีย์บอร์ด
 * แล้วระบายพื้นหลังแถบสถานะเป็นสีเดียวกับหัวแอป (#182031 — src/layouts/Header.css) ให้ดูเป็นชิ้นเดียว
 * ⚠️ ใช้ได้ทุกรุ่น Android (รุ่นเก่าที่ไม่ได้วาดเต็มจอ ค่า inset = 0 ก็ไม่มีอะไรเปลี่ยน)
 */
public class MainActivity extends BridgeActivity {
    private static final int HEADER_COLOR = Color.parseColor("#182031");
    private static final int PAGE_COLOR = Color.parseColor("#ffffff");

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        bars.setAppearanceLightStatusBars(false);     // ไอคอนสีขาวบนหัวสีเข้ม
        bars.setAppearanceLightNavigationBars(true);  // ปุ่มนำทางสีเข้มบนพื้นขาว

        FrameLayout root = findViewById(android.R.id.content);
        root.setBackgroundColor(PAGE_COLOR);
        View statusBg = new View(this);
        statusBg.setBackgroundColor(HEADER_COLOR);
        root.addView(statusBg, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, Gravity.TOP));

        View webView = getBridge().getWebView();
        ViewCompat.setOnApplyWindowInsetsListener(webView, (v, insets) -> {
            Insets sys = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());

            ViewGroup.MarginLayoutParams lp = (ViewGroup.MarginLayoutParams) v.getLayoutParams();
            lp.topMargin = sys.top;
            lp.leftMargin = sys.left;
            lp.rightMargin = sys.right;
            lp.bottomMargin = Math.max(sys.bottom, ime.bottom); // คีย์บอร์ดขึ้น = หน้าหดตาม ช่องกรอกไม่โดนบัง
            v.setLayoutParams(lp);

            ViewGroup.LayoutParams slp = statusBg.getLayoutParams();
            slp.height = sys.top;
            statusBg.setLayoutParams(slp);
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(webView);

        openNotificationTarget(getIntent());
    }

    /**
     * 🐛 (19 ต.ค. 2569 ผู้ใช้: "กดแจ้งเตือนแล้วเข้าไปแค่หน้าแรกแอป ไม่ไปหน้านั้นๆ")
     * แอปถูกปิดอยู่ (cold start) แล้วแตะแจ้งเตือน → Android เปิดแอปด้วย intent ที่มีข้อมูลแจ้งเตือน (url/nid)
     * แต่ปลั๊กอิน Firebase ส่งเหตุการณ์ "แตะแจ้งเตือน" เฉพาะตอนแอปเปิดค้างอยู่ (onNewIntent) เท่านั้น → ตอนเปิดใหม่หายเงียบ
     * ✅ เปิดหน้าเว็บที่หน้าปลายทางตรงๆ แทนหน้าแรก (+ ?_n=<id> ให้หน้าเว็บทำเครื่องหมายอ่านแล้ว — ดู InAppPushBanner.js)
     * ⚠️ รับเฉพาะพาธภายในเว็บของเรา (ขึ้นต้นด้วย "/") — ไม่เปิดโดเมนอื่นจากข้อมูลในแจ้งเตือน
     * ⚠️ แอปเปิดค้างอยู่ (warm start) ปลั๊กอินจัดการเองผ่าน onNewIntent → nativePush.js อยู่แล้ว
     */
    private void openNotificationTarget(Intent intent) {
        if (intent == null || intent.getExtras() == null) return;
        if (!intent.getExtras().containsKey("google.message_id")) return;
        String path = intent.getStringExtra("url");
        if (path == null || !path.startsWith("/") || path.startsWith("//") || "/".equals(path)) return;
        String nid = intent.getStringExtra("nid");
        String base = getBridge().getConfig().getServerUrl();
        if (base == null || base.isEmpty()) base = "https://da-app.vercel.app";
        if (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        String target = base + path;
        if (nid != null && !nid.isEmpty()) target += (path.contains("?") ? "&" : "?") + "_n=" + Uri.encode(nid);
        intent.removeExtra("google.message_id"); // หมุนจอ/สร้างหน้าใหม่ จะไม่เปิดซ้ำ
        final String url = target;
        getBridge().getWebView().post(() -> getBridge().getWebView().loadUrl(url));
    }
}
