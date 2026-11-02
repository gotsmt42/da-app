/**
 * appIcons.js — ไอคอนเมนูชุดกลางของทั้งแอป (Material Rounded แบบทึบ ทรงโค้งมน)
 *
 * ✅ (1 พ.ย. 2569 ผู้ใช้: "หน้าอื่นๆให้ปรับเปลี่ยน icon ให้สอดคล้องกับหน้าแรก ให้สวยงาม")
 *    เดิมเมนูทั้งแอปใช้ FontAwesome (เหลี่ยม แข็ง) ส่วนหน้าแรกมือถือเปลี่ยนเป็น Material Rounded แล้ว
 *    → ทะเบียนเมนูกลาง (layouts/navConfig.js) ใช้ชุดนี้ = เมนูข้าง · แถบล่าง · แถบบน · หน้าแรก เปลี่ยนพร้อมกัน
 *
 * ⚠️ ห่อด้วย asIcon ให้ใช้แทนไอคอน react-icons ได้ทันที (ไม่ต้องไล่แก้จุดที่เรียก):
 *    • <Icon size={14} />  → ขนาด 14px เหมือนเดิม (MUI ไม่รู้จัก prop size เอง)
 *    • <Icon />            → ขนาด 1em ของตัวหนังสือรอบข้าง เหมือน react-icons (MUI ตั้งต้น 24px)
 *    • className / style ส่งต่อครบ — CSS ที่ตั้ง font-size ให้ไอคอนยังมีผล
 */
import { createElement } from "react";
import HomeRounded from "@mui/icons-material/HomeRounded";
import SpaceDashboardRounded from "@mui/icons-material/SpaceDashboardRounded";
import CalendarMonthRounded from "@mui/icons-material/CalendarMonthRounded";
import EventAvailableRounded from "@mui/icons-material/EventAvailableRounded";
import WorkRounded from "@mui/icons-material/WorkRounded";
import ChecklistRounded from "@mui/icons-material/ChecklistRounded";
import MoveToInboxRounded from "@mui/icons-material/MoveToInboxRounded";
import PlaceRounded from "@mui/icons-material/PlaceRounded";
import BarChartRounded from "@mui/icons-material/BarChartRounded";
import AssignmentTurnedInRounded from "@mui/icons-material/AssignmentTurnedInRounded";
import AssignmentRounded from "@mui/icons-material/AssignmentRounded";
import ArchiveRounded from "@mui/icons-material/ArchiveRounded";
import InboxRounded from "@mui/icons-material/InboxRounded";
import SendRounded from "@mui/icons-material/SendRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import ShoppingCartRounded from "@mui/icons-material/ShoppingCartRounded";
import Inventory2Rounded from "@mui/icons-material/Inventory2Rounded";
import MoreTimeRounded from "@mui/icons-material/MoreTimeRounded";
import EngineeringRounded from "@mui/icons-material/EngineeringRounded";
import FactCheckRounded from "@mui/icons-material/FactCheckRounded";
import FolderRounded from "@mui/icons-material/FolderRounded";
import RequestQuoteRounded from "@mui/icons-material/RequestQuoteRounded";
import BusinessRounded from "@mui/icons-material/BusinessRounded";
import GroupsRounded from "@mui/icons-material/GroupsRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import LocalOfferRounded from "@mui/icons-material/LocalOfferRounded";
import ImageRounded from "@mui/icons-material/ImageRounded";
import MarkEmailUnreadRounded from "@mui/icons-material/MarkEmailUnreadRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import CollectionsRounded from "@mui/icons-material/CollectionsRounded";
import ArticleRounded from "@mui/icons-material/ArticleRounded";
import TuneRounded from "@mui/icons-material/TuneRounded";
import AdminPanelSettingsRounded from "@mui/icons-material/AdminPanelSettingsRounded";
import AccountBalanceWalletRounded from "@mui/icons-material/AccountBalanceWalletRounded";
import AccountCircleRounded from "@mui/icons-material/AccountCircleRounded";
import MenuRounded from "@mui/icons-material/MenuRounded";
import HandymanRounded from "@mui/icons-material/HandymanRounded";
import BadgeRounded from "@mui/icons-material/BadgeRounded";
import StorageRounded from "@mui/icons-material/StorageRounded";
import LanguageRounded from "@mui/icons-material/LanguageRounded";
import HistoryRounded from "@mui/icons-material/HistoryRounded";

/** ทำให้ไอคอน MUI รับ prop แบบ react-icons (size) และมีขนาดตั้งต้น 1em */
export const asIcon = (Mui) => {
  const Icon = ({ size, style, ...rest }) => createElement(Mui, {
    ...rest,
    fontSize: "inherit",
    style: size != null ? { fontSize: typeof size === "number" ? `${size}px` : size, ...style } : style,
  });
  Icon.displayName = `AppIcon(${Mui.displayName || Mui.type?.render?.displayName || "Icon"})`;
  return Icon;
};

export const AppIcon = {
  Home: asIcon(HomeRounded),
  Dashboard: asIcon(SpaceDashboardRounded),
  Calendar: asIcon(CalendarMonthRounded),
  CalendarMine: asIcon(EventAvailableRounded),
  Sales: asIcon(WorkRounded),
  Operation: asIcon(ChecklistRounded),
  Intake: asIcon(MoveToInboxRounded),
  Attendance: asIcon(PlaceRounded),
  Report: asIcon(BarChartRounded),
  MyJobs: asIcon(AssignmentTurnedInRounded),
  Contract: asIcon(AssignmentRounded),
  Archive: asIcon(ArchiveRounded),
  Inbox: asIcon(InboxRounded),
  Send: asIcon(SendRounded),
  Advance: asIcon(PaymentsRounded),
  Claim: asIcon(ReceiptLongRounded),
  Purchase: asIcon(ShoppingCartRounded),
  Stock: asIcon(Inventory2Rounded),
  History: asIcon(HistoryRounded),
  Ot: asIcon(MoreTimeRounded),
  Contractor: asIcon(EngineeringRounded),
  Approve: asIcon(FactCheckRounded),
  Documents: asIcon(FolderRounded),
  Quotation: asIcon(RequestQuoteRounded),
  Customers: asIcon(BusinessRounded),
  Staff: asIcon(GroupsRounded),
  Settings: asIcon(SettingsRounded),
  Tag: asIcon(LocalOfferRounded),
  Image: asIcon(ImageRounded),
  Leads: asIcon(MarkEmailUnreadRounded),
  Products: asIcon(StorefrontRounded),
  Gallery: asIcon(CollectionsRounded),
  Article: asIcon(ArticleRounded),
  Tune: asIcon(TuneRounded),
  Permissions: asIcon(AdminPanelSettingsRounded),
  Wallet: asIcon(AccountBalanceWalletRounded),
  Account: asIcon(AccountCircleRounded),
  Menu: asIcon(MenuRounded),
  // หัวหมวดเมนู (หน้าแรกจอคอม)
  Tools: asIcon(HandymanRounded),
  People: asIcon(BadgeRounded),
  Database: asIcon(StorageRounded),
  Website: asIcon(LanguageRounded),
};
