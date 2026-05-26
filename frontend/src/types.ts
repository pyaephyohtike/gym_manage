export type MembershipTier = "vip" | "gold" | "silver" | "normal";
export type StaffRole = "management" | "trainer" | "sales";
export type AppointmentStatus = "booked" | "completed" | "canceled" | "no_show";
export type SaleType = "member" | "walkin";

export interface MembershipPlan {
  id: number;
  tier: MembershipTier;
  monthly_fee: number;
  description?: string | null;
}

export interface Member {
  id: number;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  joined_at: string;
  is_active: boolean;
  plan_id: number;
}

export interface Staff {
  id: number;
  full_name: string;
  role: StaffRole;
  phone?: string | null;
  email?: string | null;
  is_active: boolean;
}

export interface TrainerSchedule {
  id: number;
  trainer_id: number;
  weekday: number;
  start_time: string;
  end_time: string;
}

export interface TrainerAssignment {
  id: number;
  member_id: number;
  trainer_id: number;
  start_date: string;
  end_date?: string | null;
  is_active: boolean;
}

export interface Appointment {
  id: number;
  member_id: number;
  trainer_id: number;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  notes?: string | null;
}

export interface InventoryItem {
  id: number;
  name: string;
  sku: string;
  unit_price: number;
  quantity_on_hand: number;
  reorder_level: number;
  is_active: boolean;
}

export interface SaleItem {
  id: number;
  item_id: number;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface Sale {
  id: number;
  sale_type: SaleType;
  member_id?: number | null;
  staff_id?: number | null;
  total_amount: number;
  created_at: string;
  items: SaleItem[];
}
