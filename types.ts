
export interface BankInfo {
  bankName: string;
  branchName: string;
  accountType: '普通' | '当座';
  accountNumber: string;
  accountHolder: string;
}

export interface AppSettings {
  companyName: string;
  postalCode?: string;
  address?: string;
  phone?: string;
  fax?: string;
  email?: string;
  invoiceNumber?: string;
  categories: string[];
  adminPassword?: string;
  securityQuestion?: string;
  securityAnswer?: string;
  sealImage?: string;
  banks?: BankInfo[];
}

export const MATERIAL_CATEGORIES = [
  "鋼管類", "銅管類", "ステンレス管類", "塩ビ管類", "CD・PF管類", "ダクト類", "ポリパイプ", "ボイド管", "ワンダーチューブ", "その他管",
  "鋼管継手", "銅管継手", "ステンレス継手", "排水継手", "樹脂管継手", "その他継手",
  "フランジ・パッキン", "バルブ", "支持金物", "アンカー・ボルト",
  "保温材", "シール材", "空調部材", "排気筒関連", "衛生器具", "計器類", "機器類", "工具", "建材", "消耗品・雑材"
] as const;

export type Category = typeof MATERIAL_CATEGORIES[number];

export interface Material {
  id: string;
  category: string;
  name: string;
  manufacturer?: string;
  model: string;
  dimensions: string;
  size?: string;
  quantity: number;
  unit: string;
  location: string;
  notes?: string;
  listPrice: number;
  sellingPrice: number;
  costPrice: number; // 仕入値
  previousListPrice?: number; // 旧定価（改定後に退避）
  previousCostPrice?: number; // 旧仕入値（改定後に退避）
  priceUpdatedDate?: string; // 実際に改定された日
  scheduledListPrice?: number; // 予告改定：新定価
  scheduledCostPrice?: number; // 予告改定：新仕入値
  scheduledSellingPrice?: number; // 予告改定：新標準売価
  scheduledPriceDate?: string; // 予告改定：改定予定日 (YYYY-MM-DD)
  sourceUrl?: string;
  updatedAt: number;
}

export type MaterialItem = Material;

export type SortField = keyof Omit<Material, 'id' | 'updatedAt' | 'sourceUrl' | 'category'> | 'profitMargin';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export interface CustomerSite {
  id: string;
  name: string;
  isClosed?: boolean;
  notes?: string;
  createdAt?: number;
}

export interface Customer {
  id: string;
  name: string;
  closingDay?: number;
  email?: string;
  sites?: CustomerSite[];
}

export interface PricingRule {
  id: string;
  customerId?: string;
  siteId?: string;
  customerName: string; // 移行期間のため残す
  siteName?: string;    // 移行期間のため残す
  category: string;
  model: string;
  dimensions?: string; // 表示用寸法
  materialId?: string; // 特定の資材を指定する場合
  materialName?: string; // 表示用名称
  method: 'percent_of_list' | 'markup_on_cost' | 'fixed_price';
  value: number;
}

export type ItemKind = '材料' | '工事費' | '外注費' | 'その他';

export interface SlipItem extends Material {
  itemKind?: ItemKind; // 明細の種類（材料/工事費/外注費/その他）
  quantity: number;
  deliveredQuantity?: number;
  appliedPrice: number;
  date?: string;
  orderDate?: string;
  sourceSlipNo?: string;
  slipItemNote?: string;
}

export type DeliveryTime = 'morning_first' | 'am' | 'afternoon_first' | 'pm' | 'none';
export type DeliveryDestination = 'site' | 'factory' | 'office' | 'home' | 'bring' | 'carrier' | 'none';

export interface Slip {
  id: string;
  groupId?: string;
  slipNumber?: string;
  createdAt: number;
  date: string;
  orderDate?: string;    // 受注日
  shippingDate?: string; // 出庫日/希望日
  customerId?: string;
  siteId?: string;
  customerName: string; // 移行期間のため残す
  constructionName?: string; // 移行期間のため残す
  type: SlipType;
  items: SlipItem[];
  totalAmount: number;
  taxAmount: number;
  grandTotal: number;
  note?: string;
  deliveryTime: DeliveryTime;
  deliveryDestination: DeliveryDestination;
  isClosed?: boolean;
  siteSummaries?: { name: string; total: number }[];
  orderingPerson?: string;
  customerOrderNumber?: string; // 注文番号
  receivingPerson?: string;
  issuerPerson?: string;
  deliveryPerson?: string;
  receiverPerson?: string;
  isHandled?: boolean;
  isFromReslip?: boolean;  // 欠品伝票から再作成された出庫伝票フラグ
  source?: 'link' | 'core';
  // 請求書用追加フィールド
  previousBillingAmount?: number; // 前回御請求額
  paymentReceived?: number;       // 今回御入金額
  carriedForwardAmount?: number;  // 繰越残高
  isReviewed?: boolean;           // 伝票確認済みフラグ
  // 分割表示用
  documentTotal?: number;
  documentTax?: number;
  documentGrandTotal?: number;
}

export type EstimateStatus = 'pending' | 'accepted' | 'rejected' | 'converted';

export interface Estimate extends Omit<Slip, 'type' | 'isClosed'> {
  status: EstimateStatus;
  validUntil: string;
}

export type POStatus = 'draft' | 'ordered' | 'received' | 'cancelled';

export interface PurchaseOrderItem extends SlipItem {
}

export interface PurchaseOrder extends Omit<Slip, 'type' | 'isClosed'> {
  supplierName: string;
  orderDate: string;
  status: POStatus;
  expectedDeliveryDate?: string;
  items: PurchaseOrderItem[];
}

export type LinkUserRole = 'lite' | 'pro' | 'pending';

export interface LinkUserProfile {
  uid: string;
  email: string;
  displayName: string;
  companyName: string;
  phoneNumber: string;
  role: LinkUserRole;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
}
