# โครงสร้างโค้ด `src/`

จัดแบบ **feature-based** — แบ่งตาม "เรื่องทางธุรกิจ" ไม่ใช่ตาม "ชนิดไฟล์"

เหตุผล: เดิมแบ่งตามชนิด (`components/` `views/` `utils/` `services/`) ทำให้การแก้เรื่องเดียว
เช่น "ใบส่งมอบงาน" ต้องเปิดไฟล์ที่กระจายอยู่ 4 โฟลเดอร์คนละมุมของโปรเจกต์ ตอนนี้ของทุกอย่าง
ของเรื่องเดียวกันอยู่ในโฟลเดอร์เดียวกัน

```
src/
├── index.js              จุดเริ่มของแอป (Vite ชี้มาที่นี่จาก index.html)
├── index.css             สไตล์ระดับ global + ตัวแปรฟอนต์
│
├── app/                  ประกอบร่างแอป — ไม่มีตรรกะธุรกิจ
│   ├── App.js            ThemeProvider + ToastContainer + document.title
│   ├── theme.js          ธีม MUI (บังคับฟอนต์ให้ตรงกับ index.css)
│   ├── NoConnection.js   หน้าจอตอนต่อ API ไม่ได้
│   └── router/           เส้นทางทั้งหมด + ตัวคุมสิทธิ์
│       ├── index.js          ตาราง route (lazy ทุกหน้า)
│       ├── PrivateRoute.js   ต้องล็อกอิน
│       ├── PublicRoute.js    เฉพาะคนที่ยังไม่ล็อกอิน
│       └── AdminRoute.js     เฉพาะ admin
│
├── assets/               ไฟล์นิ่ง — fonts / images / scss
│
├── layouts/              โครงหน้าจอที่ครอบทุกหน้า (Sidebar, Header, Footer, Loader)
│
├── shared/               ของกลางที่ "หลาย feature" ใช้ร่วมกัน
│   ├── api/              axiosInstance — interceptor, token, base URL
│   ├── services/         ชั้นคุยกับ API ทั้งหมด (หนึ่งไฟล์ต่อหนึ่ง resource)
│   ├── hooks/            React hook ที่ใช้ข้าม feature
│   ├── ui/               คอมโพเนนต์กลางที่ไม่ผูกกับเรื่องใดเรื่องหนึ่ง
│   └── utils/            ฟังก์ชันบริสุทธิ์ + กฎธุรกิจที่ใช้ร่วมกัน
│
└── features/             แต่ละโฟลเดอร์ = หนึ่งเรื่องทางธุรกิจ
    ├── auth/             ล็อกอิน / สมัคร / AuthContext
    ├── dashboard/        หน้าแรก
    ├── calendar/         ปฏิทินแผนงาน + ฟอร์มเพิ่ม/แก้ไข/ลบงาน
    ├── operation/        การดำเนินงาน + อนุมัติคำขอปิดงาน
    ├── contracts/        ภาพรวมงานสัญญา
    ├── finance/          ใบเสนอราคา → วางบิล → รับเงิน
    ├── documents/        เอกสารงาน, ใบส่งมอบงาน, อัปโหลด/พรีวิวไฟล์
    ├── customers/        ลูกค้า
    ├── staff/            พนักงาน / ภาระงานทีม / บัญชีผู้ใช้
    ├── products/         สินค้า + สต๊อก
    ├── technician/       หน้าจอฝั่งช่าง
    ├── notifications/    กระดิ่งแจ้งเตือน
    └── settings/         ตั้งค่า + ประเภทงาน/ระบบ
```

## รูปแบบภายในแต่ละ feature

```
features/<ชื่อเรื่อง>/
├── pages/          หน้าที่ผูกกับ route (Router รู้จักแค่ไฟล์ในนี้)
├── components/     คอมโพเนนต์ที่ใช้เฉพาะเรื่องนี้
└── utils/          กฎ/ตัวช่วยเฉพาะเรื่องนี้ เช่นตัวส่งออก Excel, ตัวสร้าง PDF
```

feature ที่ไม่มีของครบทั้ง 3 ก็ไม่ต้องสร้างโฟลเดอร์เปล่าไว้

## กติกาที่ควรรักษาไว้

1. **`features/` อ้าง `shared/` ได้ แต่ `shared/` ห้ามอ้าง `features/`**
   ถ้า `shared/` ต้องรู้จักเรื่องใดเรื่องหนึ่ง แปลว่ามันไม่ใช่ของกลางจริง

2. **ของที่ 2 feature ขึ้นไปใช้ ให้ย้ายขึ้น `shared/`**
   ไม่ก็อปข้ามโฟลเดอร์ — โค้ดที่ก็อปไว้หลายที่คือต้นเหตุที่ตัวเลขบนหน้าจอไม่ตรงกัน

3. **`services/` เป็นชั้นเดียวที่คุยกับ API** คอมโพเนนต์ไม่เรียก axios เอง

4. **สิทธิ์การเข้าถึงตัดสินที่ backend เสมอ** การซ่อนเมนู/ปุ่มเป็นแค่เรื่อง UX
   ไม่ใช่การป้องกัน (ดูคอมเมนต์ในไฟล์ Hub แต่ละตัวประกอบ)

5. **หน้าใหม่ = ไฟล์ใน `features/<เรื่อง>/pages/` แล้วไป lazy import ที่ `app/router/index.js`**

## path alias `@/`

```js
import EventService from "@/shared/services/EventService";          // ✅
import EventService from "../../../shared/services/EventService";   // ❌ อย่าเขียนแบบนี้
```

ตั้งไว้ **2 ที่ ต้องแก้ให้ตรงกันเสมอ**:

| ไฟล์ | มีผลตอน |
|---|---|
| `vite.config.js` → `resolve.alias` | build / dev server / vitest — **ตัวจริงที่ทำงาน** |
| `jsconfig.json` → `compilerOptions.paths` | editor เท่านั้น (Ctrl+Click, auto-import) |

> ℹ️ ใน `jsconfig.json` มี `"ignoreDeprecations": "6.0"` อยู่ — ไม่ใช่ของเกิน
> TypeScript 6.x ที่ VS Code ใช้อยู่ยังเตือนเรื่อง `baseUrl` ทั้งที่เราไม่ได้ใส่ (มันเติมให้เองโดยปริยาย
> เมื่อเจอ `paths`) บรรทัดนี้ปิดเสียงเตือนนั้น — ทดสอบกับ TypeScript 7.0.2 แล้วว่ายังรับ option นี้
> และ config ผ่านสะอาดไม่มี error เอาบรรทัดนี้ออกได้เมื่อ VS Code เปลี่ยนไปใช้ TS 7 เป็นค่าเริ่มต้น

## คำสั่งที่ใช้บ่อย

```bash
npm start     # dev server (Vite) — http://localhost:3000
npm run build # lint แล้วค่อย build; มี warning แม้แต่ตัวเดียวก็ไม่ผ่าน
npm run lint  # ตรวจอย่างเดียว
npm test      # vitest
```
