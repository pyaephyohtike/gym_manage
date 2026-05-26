import type {
  Appointment,
  AppointmentStatus,
  InventoryItem,
  Member,
  MembershipPlan,
  Sale,
  SaleType,
  Staff,
  StaffRole,
  TrainerAssignment,
  TrainerSchedule,
} from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail ?? JSON.stringify(body);
    } catch {
      // Ignore parse errors and keep status text.
    }
    throw new ApiError(detail, response.status);
  }

  return (await response.json()) as T;
}

export const api = {
  getPlans: () => request<MembershipPlan[]>("/api/membership-plans"),
  getMembers: () => request<Member[]>("/api/members"),
  createMember: (payload: { full_name: string; phone?: string; email?: string; plan_id: number }) =>
    request<Member>("/api/members", { method: "POST", body: JSON.stringify(payload) }),

  getStaff: (role?: StaffRole) => request<Staff[]>(`/api/staff${role ? `?role=${role}` : ""}`),
  createStaff: (payload: { full_name: string; role: StaffRole; phone?: string; email?: string }) =>
    request<Staff>("/api/staff", { method: "POST", body: JSON.stringify(payload) }),

  getSchedules: (trainerId: number) => request<TrainerSchedule[]>(`/api/trainer-schedules/${trainerId}`),
  createSchedule: (payload: { trainer_id: number; weekday: number; start_time: string; end_time: string }) =>
    request<TrainerSchedule>("/api/trainer-schedules", { method: "POST", body: JSON.stringify(payload) }),

  getAssignments: () => request<TrainerAssignment[]>("/api/trainer-assignments"),
  createAssignment: (payload: {
    member_id: number;
    trainer_id: number;
    start_date: string;
    end_date?: string;
    is_active?: boolean;
  }) => request<TrainerAssignment>("/api/trainer-assignments", { method: "POST", body: JSON.stringify(payload) }),

  getAppointments: () => request<Appointment[]>("/api/appointments"),
  createAppointment: (payload: {
    member_id: number;
    trainer_id: number;
    starts_at: string;
    ends_at: string;
    notes?: string;
  }) => request<Appointment>("/api/appointments", { method: "POST", body: JSON.stringify(payload) }),
  updateAppointmentStatus: (id: number, status: AppointmentStatus) =>
    request<Appointment>(`/api/appointments/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),

  getInventory: (onlyLowStock = false) => request<InventoryItem[]>(`/api/inventory?only_low_stock=${onlyLowStock}`),
  createInventoryItem: (payload: {
    name: string;
    sku: string;
    unit_price: number;
    quantity_on_hand: number;
    reorder_level: number;
  }) => request<InventoryItem>("/api/inventory", { method: "POST", body: JSON.stringify(payload) }),
  adjustInventory: (itemId: number, payload: { quantity_delta: number; reason: string }) =>
    request(`/api/inventory/${itemId}/adjust`, { method: "POST", body: JSON.stringify(payload) }),

  getSales: () => request<Sale[]>("/api/sales"),
  createSale: (payload: {
    sale_type: SaleType;
    member_id?: number;
    staff_id?: number;
    items: { item_id: number; quantity: number }[];
  }) => request<Sale>("/api/sales", { method: "POST", body: JSON.stringify(payload) }),
};

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error";
}
