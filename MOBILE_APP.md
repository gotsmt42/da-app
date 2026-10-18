# แอปมือถือ TidTam (Android + iPhone)

แอปมือถือใช้โค้ดหน้าเว็บชุดเดียวกับเว็บ ห่อด้วย [Capacitor](https://capacitorjs.com)
แก้หน้าเว็บที่เดียว จะได้ทั้งเว็บ Android และ iPhone

- **เว็บยังใช้ได้เหมือนเดิมทุกอย่าง** โค้ดฝั่งแอปทำงานเฉพาะในแอป (`Capacitor.isNativePlatform()`) และไม่มีผลกับเว็บ
- แอปเรียก API จริงที่ `https://da-app-server.onrender.com/api` เสมอ (ดู [src/shared/api/apiUrl.js](src/shared/api/apiUrl.js))

| ส่วน | ไฟล์ |
|---|---|
| ตั้งค่าแอป (ชื่อ, รหัสแอป `com.tidtam.app`, สี, splash) | [capacitor.config.json](capacitor.config.json) |
| ดาวน์โหลดไฟล์ / ลิงก์ภายนอก / ปุ่มย้อนกลับ Android | [src/native/nativeBridge.js](src/native/nativeBridge.js) |
| แจ้งเตือนแบบแอป (Firebase) | [src/native/nativePush.js](src/native/nativePush.js) + server `src/services/NativePush.js` |
| โปรเจกต์ Android / iPhone | [android/](android/) · [ios/](ios/) |
| ไอคอน + หน้าเปิดแอป | [scripts/make-native-assets.js](scripts/make-native-assets.js) → `npm run cap:assets` |
| สร้างแอปบนคลาวด์ | [.github/workflows/mobile-android.yml](.github/workflows/mobile-android.yml) · [mobile-ios.yml](.github/workflows/mobile-ios.yml) |

---

## 1. สร้างแอปทดสอบ Android (ไม่ต้องตั้งค่าอะไรเพิ่ม)

1. เปิด GitHub › repo `da-app` › แท็บ **Actions**
2. เลือก **Mobile · Android** แล้วกด **Run workflow**
3. รอประมาณ 8 นาที จากนั้นเปิดรายการที่รันเสร็จ แล้วดาวน์โหลดไฟล์ใต้ **Artifacts**
4. แตกไฟล์ zip แล้วส่ง `app-debug.apk` เข้ามือถือ Android เพื่อติดตั้ง
   (เครื่องจะถามเรื่อง "ติดตั้งจากแหล่งที่ไม่รู้จัก" ให้กดอนุญาต)

ถ้ายังไม่ได้ทำขั้นตอนที่ 2 แอปจะใช้งานได้ทุกหน้า แต่ยังไม่รับแจ้งเตือน

## 2. เปิดการแจ้งเตือนในแอป (Firebase · ฟรี)

แอปรับ Web Push แบบเว็บไม่ได้ จึงต้องใช้ Firebase Cloud Messaging แทน
server ส่งให้ทั้ง Android และ iPhone ได้ทางเดียวกัน

1. ไปที่ <https://console.firebase.google.com> › **Add project** แล้วตั้งชื่อ (เช่น TidTam)
2. **เพิ่มแอป Android**
   - package name ใส่ `com.tidtam.app`
   - ดาวน์โหลด `google-services.json`
3. **เพิ่มแอป iOS**
   - bundle ID ใส่ `com.tidtam.app`
   - ดาวน์โหลด `GoogleService-Info.plist`
4. **ให้ server ส่งแจ้งเตือนได้**
   - ที่ Project settings › Service accounts กด **Generate new private key** จะได้ไฟล์ JSON
   - ใน Render › da-app-server › Environment เพิ่มตัวแปร `FIREBASE_SERVICE_ACCOUNT` แล้ววางเนื้อหาไฟล์ JSON ทั้งก้อน
5. **ใส่ไฟล์ให้ GitHub ใช้ตอนสร้างแอป**
   - ไปที่ GitHub › Settings › Secrets and variables › Actions › New repository secret
   - `GOOGLE_SERVICES_JSON` = เนื้อหาไฟล์ `google-services.json`
   - `GOOGLE_SERVICE_INFO_PLIST` = เนื้อหาไฟล์ `GoogleService-Info.plist`
6. สำหรับ iPhone ต้องเพิ่มอีกขั้นหนึ่ง (ต้องมีบัญชี Apple Developer ก่อน)
   - ที่ <https://developer.apple.com> › Keys สร้าง key แบบ **Apple Push Notifications service (APNs)** แล้วดาวน์โหลดไฟล์ `.p8`
   - อัปโหลดไฟล์ `.p8` ที่ Firebase › Project settings › Cloud Messaging › Apple app configuration

ไฟล์ทั้งหมดในขั้นตอนนี้ **ห้าม commit ลง git** (`.gitignore` กันไว้แล้ว)
และ **ห้ามใส่ใน REACT_APP_*** ให้ใส่ผ่าน Secrets เท่านั้น

## 3. ขึ้น Google Play Store

- ต้องมีบัญชี [Google Play Console](https://play.google.com/console) (จ่ายครั้งเดียว 25 USD)

1. สร้างกุญแจลงชื่อแอป (ทำครั้งเดียว และ **ห้ามทำหาย** เพราะถ้าหาย จะอัปเดตแอปเดิมบน Play Store ไม่ได้อีก)
   ```bash
   keytool -genkey -v -keystore tidtam-release.keystore -alias tidtam -keyalg RSA -keysize 2048 -validity 10000
   ```
2. เพิ่ม Secrets ใน GitHub
   - `ANDROID_KEYSTORE_BASE64`: ผลของคำสั่ง `base64 -w0 tidtam-release.keystore`
   - `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`tidtam`), `ANDROID_KEY_PASSWORD`
3. สั่ง build ได้สองแบบ
   - รัน workflow **Mobile · Android** อีกครั้ง
   - หรือติด tag แล้ว push: `git tag app-v1.0.0 && git push origin app-v1.0.0`
4. ใน Artifacts จะมี `app-release.aab` ให้อัปโหลดไฟล์นี้ใน Play Console
   - แนะนำให้เริ่มที่ Internal testing ก่อน

## 4. ขึ้น App Store / TestFlight (iPhone)

- ต้องมีบัญชี [Apple Developer Program](https://developer.apple.com/programs/) (99 USD/ปี)
- ไม่ต้องมี Mac เพราะใช้เครื่อง Mac ของ GitHub แทน

1. ที่ App Store Connect › Apps › **+ New App** › Bundle ID ใส่ `com.tidtam.app`
2. ที่ App Store Connect › Users and Access › Integrations สร้าง **App Store Connect API Key** สิทธิ์ Admin แล้วดาวน์โหลดไฟล์ `.p8`
3. เพิ่ม Secrets ใน GitHub
   - `APPSTORE_API_KEY_P8` (เนื้อหาไฟล์ `.p8`)
   - `APPSTORE_API_KEY_ID`
   - `APPSTORE_API_ISSUER_ID`
   - `APPLE_TEAM_ID` (ดูได้ที่ developer.apple.com › Membership)
4. รัน workflow **Mobile · iPhone** ระบบจะลงชื่อแอปและอัปโหลดขึ้น **TestFlight** ให้อัตโนมัติ
   - ติดตั้งทดสอบผ่านแอป TestFlight บน iPhone ได้ แล้วค่อยกดส่งรีวิวขึ้น App Store

ถ้ายังไม่ใส่ Secrets workflow นี้จะตรวจแค่ว่าแอป iPhone build ผ่าน (Simulator)

---

## พัฒนาบนเครื่องตัวเอง (ถ้ามี Android Studio / Xcode)

```bash
npm run build:native   # lint + build หน้าเว็บโหมดแอป + คัดลอกเข้า android/ ios/
npm run cap:android    # เปิด Android Studio (กด ▶ เพื่อรันบนมือถือ/อีมูเลเตอร์)
npm run cap:ios        # เปิด Xcode (เฉพาะ Mac)
npm run cap:assets     # สร้างไอคอน/หน้าเปิดแอปใหม่ หลังเปลี่ยนโลโก้ (npm run brand)
```

- ถ้าอยากทดสอบกับ server อื่น ให้ตั้ง `REACT_APP_NATIVE_API_URL=https://...` ตอน build
  - ต้องเป็น https เท่านั้น
- server ต้องอนุญาต origin `https://localhost` (Android) และ `capacitor://localhost` (iPhone)
  - ตั้งไว้แล้วใน `da-app-server/src/app.js`

## สิ่งที่แอปทำต่างจากเว็บ

| เรื่อง | ในแอป |
|---|---|
| ดาวน์โหลด Excel / PDF | บันทึกลงเครื่องแล้วเปิดเมนู "เปิด/แชร์" ให้ดู บันทึก หรือส่งต่อทาง LINE / อีเมลได้ |
| ลิงก์ภายนอก (แผนที่, ไฟล์แนบ) | เปิดในเบราว์เซอร์ภายในแอป ปิดแล้วกลับมาหน้าเดิม |
| ปุ่มย้อนกลับ Android | ถ้ามีกล่องเปิดอยู่จะปิดกล่องก่อน ถ้าไม่มีจะย้อนหน้า และถ้าอยู่หน้าแรกจะออกจากแอป |
| แจ้งเตือน | เด้งแบบแอปจริง มีเสียง และตัวเลขบนไอคอน แตะแล้วเปิดหน้าที่เกี่ยวข้อง ส่วนตอนเปิดแอปอยู่จะแสดงแบนเนอร์แบบเดียวกับเว็บ |
| กล้อง / ตำแหน่ง | เครื่องจะถามอนุญาตครั้งแรกที่ใช้ (แนบรูป, ลงเวลาเข้า-ออกงาน) |

## อัปเดตแอป

- **แก้หน้าเว็บ:** ต้อง build แอปใหม่แล้วส่งขึ้นสโตร์ใหม่ เพราะไฟล์หน้าเว็บถูกฝังอยู่ในแอป
  - ผู้ใช้เว็บได้ของใหม่ทันทีที่ Render deploy เหมือนเดิม
- **แก้ฝั่ง server:** แอปได้ผลทันที ไม่ต้องอัปเดตแอป
