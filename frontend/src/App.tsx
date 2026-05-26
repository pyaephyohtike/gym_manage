import { FormEvent, useEffect, useMemo, useState } from "react";

import { api, getApiErrorMessage } from "./api";
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

const WEEKDAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type TabKey = "members" | "appointments" | "pos" | "schedule";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function toLocalDateTimeInputValue(date: Date): string {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 16);
}

function formatDateTime(isoText: string): string {
  return new Date(isoText).toLocaleString();
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("members");

  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [assignments, setAssignments] = useState<TrainerAssignment[]>([]);
  const [trainerSchedules, setTrainerSchedules] = useState<Record<number, TrainerSchedule[]>>({});

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadBaseData() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [plansData, membersData, staffData, appointmentsData, inventoryData, salesData, assignmentsData] =
        await Promise.all([
          api.getPlans(),
          api.getMembers(),
          api.getStaff(),
          api.getAppointments(),
          api.getInventory(),
          api.getSales(),
          api.getAssignments(),
        ]);
      setPlans(plansData);
      setMembers(membersData);
      setStaff(staffData);
      setAppointments(appointmentsData);
      setInventory(inventoryData);
      setSales(salesData);
      setAssignments(assignmentsData);

      const trainers = staffData.filter((item) => item.role === "trainer");
      const allSchedules = await Promise.all(
        trainers.map(async (trainer) => ({ trainerId: trainer.id, rows: await api.getSchedules(trainer.id) })),
      );
      const scheduleMap: Record<number, TrainerSchedule[]> = {};
      for (const schedule of allSchedules) {
        scheduleMap[schedule.trainerId] = schedule.rows;
      }
      setTrainerSchedules(scheduleMap);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBaseData();
  }, []);

  const trainers = useMemo(() => staff.filter((person) => person.role === "trainer"), [staff]);

  async function runAction(action: () => Promise<void>) {
    setErrorMessage(null);
    try {
      await action();
      await loadBaseData();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    }
  }

  return (
    <div className="page-shell">
      <header className="header">
        <h1>Gym Management Dashboard</h1>
        <p>Members, appointments, inventory POS, and trainer scheduling in one place.</p>
      </header>

      <nav className="tabs">
        <button className={activeTab === "members" ? "active" : ""} onClick={() => setActiveTab("members")}>Members</button>
        <button className={activeTab === "appointments" ? "active" : ""} onClick={() => setActiveTab("appointments")}>Appointments</button>
        <button className={activeTab === "pos" ? "active" : ""} onClick={() => setActiveTab("pos")}>Inventory POS</button>
        <button className={activeTab === "schedule" ? "active" : ""} onClick={() => setActiveTab("schedule")}>Staff & Schedules</button>
      </nav>

      {loading && <p className="info">Loading dashboard data...</p>}
      {errorMessage && <p className="error">{errorMessage}</p>}

      {activeTab === "members" && (
        <MembersPanel plans={plans} members={members} onCreateMember={(payload) => runAction(() => api.createMember(payload).then(() => undefined))} />
      )}

      {activeTab === "appointments" && (
        <AppointmentsPanel
          appointments={appointments}
          members={members}
          trainers={trainers}
          onCreate={(payload) => runAction(() => api.createAppointment(payload).then(() => undefined))}
          onStatusChange={(id, status) => runAction(() => api.updateAppointmentStatus(id, status).then(() => undefined))}
        />
      )}

      {activeTab === "pos" && (
        <InventoryPosPanel
          inventory={inventory}
          members={members}
          staff={staff}
          sales={sales}
          onCreateItem={(payload) => runAction(() => api.createInventoryItem(payload).then(() => undefined))}
          onAdjust={(itemId, payload) => runAction(() => api.adjustInventory(itemId, payload).then(() => undefined))}
          onCreateSale={(payload) => runAction(() => api.createSale(payload).then(() => undefined))}
        />
      )}

      {activeTab === "schedule" && (
        <SchedulePanel
          staff={staff}
          trainers={trainers}
          members={members}
          schedules={trainerSchedules}
          assignments={assignments}
          onCreateStaff={(payload) => runAction(() => api.createStaff(payload).then(() => undefined))}
          onCreateSchedule={(payload) => runAction(() => api.createSchedule(payload).then(() => undefined))}
          onCreateAssignment={(payload) => runAction(() => api.createAssignment(payload).then(() => undefined))}
        />
      )}
    </div>
  );
}

function MembersPanel({
  plans,
  members,
  onCreateMember,
}: {
  plans: MembershipPlan[];
  members: Member[];
  onCreateMember: (payload: { full_name: string; phone?: string; email?: string; plan_id: number }) => Promise<void>;
}) {
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    plan_id: 0,
  });

  useEffect(() => {
    if (plans.length > 0 && form.plan_id === 0) {
      setForm((previous) => ({ ...previous, plan_id: plans[0].id }));
    }
  }, [plans, form.plan_id]);

  const planMap = useMemo(() => {
    const map: Record<number, MembershipPlan> = {};
    for (const plan of plans) {
      map[plan.id] = plan;
    }
    return map;
  }, [plans]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.full_name || form.plan_id === 0) {
      return;
    }
    await onCreateMember({
      full_name: form.full_name,
      phone: form.phone || undefined,
      email: form.email || undefined,
      plan_id: Number(form.plan_id),
    });
    setForm((previous) => ({ ...previous, full_name: "", phone: "", email: "" }));
  }

  return (
    <section className="grid two">
      <article className="panel">
        <h2>Add Member</h2>
        <form onSubmit={handleSubmit} className="form-grid">
          <label>
            Full name
            <input
              value={form.full_name}
              onChange={(event) => setForm((previous) => ({ ...previous, full_name: event.target.value }))}
              required
            />
          </label>
          <label>
            Phone
            <input value={form.phone} onChange={(event) => setForm((previous) => ({ ...previous, phone: event.target.value }))} />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))}
            />
          </label>
          <label>
            Membership plan
            <select
              value={form.plan_id}
              onChange={(event) => setForm((previous) => ({ ...previous, plan_id: Number(event.target.value) }))}
            >
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.tier.toUpperCase()} (${plan.monthly_fee}/mo)
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Create Member</button>
        </form>
      </article>

      <article className="panel">
        <h2>Membership Plans</h2>
        <ul className="compact-list">
          {plans.map((plan) => (
            <li key={plan.id}>
              <strong>{plan.tier.toUpperCase()}</strong> - ${plan.monthly_fee.toFixed(2)} / month
            </li>
          ))}
        </ul>
      </article>

      <article className="panel span-two">
        <h2>Members</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Tier</th>
              <th>Contact</th>
              <th>Status</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td>{member.full_name}</td>
                <td>{planMap[member.plan_id]?.tier.toUpperCase() ?? `#${member.plan_id}`}</td>
                <td>{member.phone || member.email || "-"}</td>
                <td>{member.is_active ? "Active" : "Inactive"}</td>
                <td>{formatDateTime(member.joined_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  );
}

function AppointmentsPanel({
  appointments,
  members,
  trainers,
  onCreate,
  onStatusChange,
}: {
  appointments: Appointment[];
  members: Member[];
  trainers: Staff[];
  onCreate: (payload: {
    member_id: number;
    trainer_id: number;
    starts_at: string;
    ends_at: string;
    notes?: string;
  }) => Promise<void>;
  onStatusChange: (appointmentId: number, status: AppointmentStatus) => Promise<void>;
}) {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [form, setForm] = useState({
    member_id: 0,
    trainer_id: 0,
    starts_at: toLocalDateTimeInputValue(new Date(Date.now() + 3600_000)),
    duration_minutes: 60,
    notes: "",
  });

  useEffect(() => {
    if (members.length > 0 && form.member_id === 0) {
      setForm((previous) => ({ ...previous, member_id: members[0].id }));
    }
  }, [members, form.member_id]);

  useEffect(() => {
    if (trainers.length > 0 && form.trainer_id === 0) {
      setForm((previous) => ({ ...previous, trainer_id: trainers[0].id }));
    }
  }, [trainers, form.trainer_id]);

  const memberNameById = useMemo(
    () => Object.fromEntries(members.map((member) => [member.id, member.full_name])),
    [members],
  );
  const trainerNameById = useMemo(
    () => Object.fromEntries(trainers.map((trainer) => [trainer.id, trainer.full_name])),
    [trainers],
  );

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);

  const weekAppointments = useMemo(() => {
    const start = weekStart.getTime();
    const end = addDays(weekStart, 7).getTime();
    return appointments
      .filter((appointment) => {
        const timestamp = new Date(appointment.starts_at).getTime();
        return timestamp >= start && timestamp < end;
      })
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [appointments, weekStart]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!form.member_id || !form.trainer_id) {
      return;
    }
    const startDate = new Date(form.starts_at);
    const endDate = new Date(startDate.getTime() + form.duration_minutes * 60_000);
    await onCreate({
      member_id: form.member_id,
      trainer_id: form.trainer_id,
      starts_at: startDate.toISOString(),
      ends_at: endDate.toISOString(),
      notes: form.notes || undefined,
    });
    setForm((previous) => ({ ...previous, notes: "" }));
  }

  return (
    <section className="grid two">
      <article className="panel">
        <h2>Book Appointment</h2>
        <form onSubmit={handleCreate} className="form-grid">
          <label>
            Member
            <select
              value={form.member_id}
              onChange={(event) => setForm((previous) => ({ ...previous, member_id: Number(event.target.value) }))}
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Trainer
            <select
              value={form.trainer_id}
              onChange={(event) => setForm((previous) => ({ ...previous, trainer_id: Number(event.target.value) }))}
            >
              {trainers.map((trainer) => (
                <option key={trainer.id} value={trainer.id}>
                  {trainer.full_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Start date/time
            <input
              type="datetime-local"
              value={form.starts_at}
              onChange={(event) => setForm((previous) => ({ ...previous, starts_at: event.target.value }))}
              required
            />
          </label>
          <label>
            Duration (minutes)
            <input
              type="number"
              min={30}
              step={30}
              value={form.duration_minutes}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, duration_minutes: Number(event.target.value) || 60 }))
              }
            />
          </label>
          <label>
            Notes
            <textarea
              value={form.notes}
              onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))}
              rows={3}
            />
          </label>
          <button type="submit">Create Appointment</button>
        </form>
      </article>

      <article className="panel">
        <h2>Week Navigation</h2>
        <div className="row">
          <button type="button" onClick={() => setWeekStart((date) => addDays(date, -7))}>
            Previous Week
          </button>
          <button type="button" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            Current Week
          </button>
          <button type="button" onClick={() => setWeekStart((date) => addDays(date, 7))}>
            Next Week
          </button>
        </div>
        <p className="muted">Showing {weekStart.toLocaleDateString()} - {addDays(weekStart, 6).toLocaleDateString()}</p>
      </article>

      <article className="panel span-two">
        <h2>Appointments Calendar</h2>
        <div className="calendar-grid">
          {weekDays.map((day, dayIndex) => {
            const dayEntries = weekAppointments.filter((appointment) => {
              const appointmentDate = new Date(appointment.starts_at);
              return (
                appointmentDate.getFullYear() === day.getFullYear() &&
                appointmentDate.getMonth() === day.getMonth() &&
                appointmentDate.getDate() === day.getDate()
              );
            });

            return (
              <div key={day.toISOString()} className="calendar-day">
                <h3>
                  {WEEKDAY_LABELS[dayIndex]}
                  <span>{day.toLocaleDateString()}</span>
                </h3>
                {dayEntries.length === 0 ? (
                  <p className="muted">No appointments</p>
                ) : (
                  <ul className="compact-list">
                    {dayEntries.map((appointment) => (
                      <li key={appointment.id}>
                        <strong>{new Date(appointment.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong>
                        <div>{memberNameById[appointment.member_id] ?? `Member #${appointment.member_id}`}</div>
                        <div>{trainerNameById[appointment.trainer_id] ?? `Trainer #${appointment.trainer_id}`}</div>
                        <select
                          value={appointment.status}
                          onChange={(event) =>
                            void onStatusChange(appointment.id, event.target.value as AppointmentStatus)
                          }
                        >
                          <option value="booked">Booked</option>
                          <option value="completed">Completed</option>
                          <option value="canceled">Canceled</option>
                          <option value="no_show">No Show</option>
                        </select>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </article>
    </section>
  );
}

function InventoryPosPanel({
  inventory,
  members,
  staff,
  sales,
  onCreateItem,
  onAdjust,
  onCreateSale,
}: {
  inventory: InventoryItem[];
  members: Member[];
  staff: Staff[];
  sales: Sale[];
  onCreateItem: (payload: {
    name: string;
    sku: string;
    unit_price: number;
    quantity_on_hand: number;
    reorder_level: number;
  }) => Promise<void>;
  onAdjust: (itemId: number, payload: { quantity_delta: number; reason: string }) => Promise<void>;
  onCreateSale: (payload: {
    sale_type: SaleType;
    member_id?: number;
    staff_id?: number;
    items: { item_id: number; quantity: number }[];
  }) => Promise<void>;
}) {
  const [newItem, setNewItem] = useState({
    name: "",
    sku: "",
    unit_price: 0,
    quantity_on_hand: 0,
    reorder_level: 5,
  });

  const [adjustment, setAdjustment] = useState({
    item_id: 0,
    quantity_delta: 0,
    reason: "",
  });

  const [saleType, setSaleType] = useState<SaleType>("walkin");
  const [saleMemberId, setSaleMemberId] = useState(0);
  const [saleStaffId, setSaleStaffId] = useState(0);
  const [cart, setCart] = useState<Array<{ item_id: number; quantity: number }>>([{ item_id: 0, quantity: 1 }]);

  useEffect(() => {
    if (inventory.length > 0) {
      setAdjustment((previous) => ({ ...previous, item_id: previous.item_id || inventory[0].id }));
      setCart((previous) =>
        previous.map((line) => ({ ...line, item_id: line.item_id === 0 ? inventory[0].id : line.item_id })),
      );
    }
    if (staff.length > 0 && saleStaffId === 0) {
      setSaleStaffId(staff[0].id);
    }
    if (members.length > 0 && saleMemberId === 0) {
      setSaleMemberId(members[0].id);
    }
  }, [inventory, members, saleMemberId, saleStaffId, staff]);

  const itemById = useMemo(() => Object.fromEntries(inventory.map((item) => [item.id, item])), [inventory]);
  const memberById = useMemo(() => Object.fromEntries(members.map((member) => [member.id, member.full_name])), [members]);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, line) => {
      const item = itemById[line.item_id];
      if (!item) {
        return sum;
      }
      return sum + item.unit_price * line.quantity;
    }, 0);
  }, [cart, itemById]);

  async function submitNewItem(event: FormEvent) {
    event.preventDefault();
    await onCreateItem(newItem);
    setNewItem({ name: "", sku: "", unit_price: 0, quantity_on_hand: 0, reorder_level: 5 });
  }

  async function submitAdjustment(event: FormEvent) {
    event.preventDefault();
    if (!adjustment.item_id || !adjustment.quantity_delta || !adjustment.reason) {
      return;
    }
    await onAdjust(adjustment.item_id, { quantity_delta: adjustment.quantity_delta, reason: adjustment.reason });
    setAdjustment((previous) => ({ ...previous, quantity_delta: 0, reason: "" }));
  }

  async function submitSale(event: FormEvent) {
    event.preventDefault();
    const validLines = cart.filter((line) => line.item_id > 0 && line.quantity > 0);
    if (validLines.length === 0) {
      return;
    }

    await onCreateSale({
      sale_type: saleType,
      member_id: saleType === "member" ? saleMemberId : undefined,
      staff_id: saleStaffId || undefined,
      items: validLines,
    });

    setCart([{ item_id: inventory[0]?.id ?? 0, quantity: 1 }]);
  }

  function updateCartLine(index: number, patch: Partial<{ item_id: number; quantity: number }>) {
    setCart((previous) => previous.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  }

  return (
    <section className="grid two">
      <article className="panel">
        <h2>Add Inventory Item</h2>
        <form onSubmit={submitNewItem} className="form-grid">
          <label>
            Name
            <input value={newItem.name} onChange={(event) => setNewItem((previous) => ({ ...previous, name: event.target.value }))} required />
          </label>
          <label>
            SKU
            <input value={newItem.sku} onChange={(event) => setNewItem((previous) => ({ ...previous, sku: event.target.value }))} required />
          </label>
          <label>
            Unit price
            <input type="number" min={0.01} step="0.01" value={newItem.unit_price} onChange={(event) => setNewItem((previous) => ({ ...previous, unit_price: Number(event.target.value) }))} required />
          </label>
          <label>
            Initial stock
            <input type="number" min={0} value={newItem.quantity_on_hand} onChange={(event) => setNewItem((previous) => ({ ...previous, quantity_on_hand: Number(event.target.value) }))} required />
          </label>
          <label>
            Reorder level
            <input type="number" min={0} value={newItem.reorder_level} onChange={(event) => setNewItem((previous) => ({ ...previous, reorder_level: Number(event.target.value) }))} />
          </label>
          <button type="submit">Add Item</button>
        </form>
      </article>

      <article className="panel">
        <h2>Stock Adjustment</h2>
        <form onSubmit={submitAdjustment} className="form-grid">
          <label>
            Item
            <select value={adjustment.item_id} onChange={(event) => setAdjustment((previous) => ({ ...previous, item_id: Number(event.target.value) }))}>
              {inventory.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.sku})
                </option>
              ))}
            </select>
          </label>
          <label>
            Quantity delta (+/-)
            <input type="number" value={adjustment.quantity_delta} onChange={(event) => setAdjustment((previous) => ({ ...previous, quantity_delta: Number(event.target.value) }))} />
          </label>
          <label>
            Reason
            <input value={adjustment.reason} onChange={(event) => setAdjustment((previous) => ({ ...previous, reason: event.target.value }))} required />
          </label>
          <button type="submit">Apply Adjustment</button>
        </form>
      </article>

      <article className="panel span-two">
        <h2>Point of Sale</h2>
        <form onSubmit={submitSale} className="form-grid">
          <label>
            Sale type
            <select value={saleType} onChange={(event) => setSaleType(event.target.value as SaleType)}>
              <option value="walkin">Walk-in</option>
              <option value="member">Member</option>
            </select>
          </label>

          {saleType === "member" && (
            <label>
              Member
              <select value={saleMemberId} onChange={(event) => setSaleMemberId(Number(event.target.value))}>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.full_name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            Processed by staff
            <select value={saleStaffId} onChange={(event) => setSaleStaffId(Number(event.target.value))}>
              <option value={0}>Unassigned</option>
              {staff.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.full_name} ({person.role})
                </option>
              ))}
            </select>
          </label>

          <div className="cart-lines">
            {cart.map((line, index) => (
              <div className="row" key={index}>
                <select value={line.item_id} onChange={(event) => updateCartLine(index, { item_id: Number(event.target.value) })}>
                  {inventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} - ${item.unit_price.toFixed(2)} ({item.quantity_on_hand} in stock)
                    </option>
                  ))}
                </select>
                <input type="number" min={1} value={line.quantity} onChange={(event) => updateCartLine(index, { quantity: Number(event.target.value) })} />
                <button type="button" onClick={() => setCart((previous) => previous.filter((_, itemIndex) => itemIndex !== index))} disabled={cart.length === 1}>
                  Remove
                </button>
              </div>
            ))}
          </div>

          <button type="button" onClick={() => setCart((previous) => [...previous, { item_id: inventory[0]?.id ?? 0, quantity: 1 }])}>
            Add Line
          </button>

          <p><strong>Total:</strong> ${cartTotal.toFixed(2)}</p>
          <button type="submit">Create Sale</button>
        </form>
      </article>

      <article className="panel span-two">
        <h2>Inventory</h2>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>SKU</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Low Stock</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((item) => (
              <tr key={item.id} className={item.quantity_on_hand <= item.reorder_level ? "warn" : ""}>
                <td>{item.name}</td>
                <td>{item.sku}</td>
                <td>${item.unit_price.toFixed(2)}</td>
                <td>{item.quantity_on_hand}</td>
                <td>{item.quantity_on_hand <= item.reorder_level ? "YES" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <article className="panel span-two">
        <h2>Recent Sales</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Member</th>
              <th>Total</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {sales.slice(0, 10).map((sale) => (
              <tr key={sale.id}>
                <td>{sale.id}</td>
                <td>{sale.sale_type}</td>
                <td>{sale.member_id ? memberById[sale.member_id] ?? sale.member_id : "Walk-in"}</td>
                <td>${sale.total_amount.toFixed(2)}</td>
                <td>{formatDateTime(sale.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  );
}

function SchedulePanel({
  staff,
  trainers,
  members,
  schedules,
  assignments,
  onCreateStaff,
  onCreateSchedule,
  onCreateAssignment,
}: {
  staff: Staff[];
  trainers: Staff[];
  members: Member[];
  schedules: Record<number, TrainerSchedule[]>;
  assignments: TrainerAssignment[];
  onCreateStaff: (payload: { full_name: string; role: StaffRole; phone?: string; email?: string }) => Promise<void>;
  onCreateSchedule: (payload: { trainer_id: number; weekday: number; start_time: string; end_time: string }) => Promise<void>;
  onCreateAssignment: (payload: {
    member_id: number;
    trainer_id: number;
    start_date: string;
    end_date?: string;
    is_active?: boolean;
  }) => Promise<void>;
}) {
  const [newStaff, setNewStaff] = useState({ full_name: "", role: "trainer" as StaffRole, phone: "", email: "" });
  const [newSchedule, setNewSchedule] = useState({ trainer_id: 0, weekday: 0, start_time: "09:00", end_time: "10:00" });
  const [newAssignment, setNewAssignment] = useState({
    member_id: 0,
    trainer_id: 0,
    start_date: todayIsoDate(),
    end_date: "",
    is_active: true,
  });

  useEffect(() => {
    if (trainers.length > 0) {
      setNewSchedule((previous) => ({ ...previous, trainer_id: previous.trainer_id || trainers[0].id }));
      setNewAssignment((previous) => ({ ...previous, trainer_id: previous.trainer_id || trainers[0].id }));
    }
    if (members.length > 0) {
      setNewAssignment((previous) => ({ ...previous, member_id: previous.member_id || members[0].id }));
    }
  }, [trainers, members]);

  const trainerNameById = useMemo(() => Object.fromEntries(trainers.map((trainer) => [trainer.id, trainer.full_name])), [trainers]);
  const memberNameById = useMemo(() => Object.fromEntries(members.map((member) => [member.id, member.full_name])), [members]);

  return (
    <section className="grid two">
      <article className="panel">
        <h2>Add Staff</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onCreateStaff({
              full_name: newStaff.full_name,
              role: newStaff.role,
              phone: newStaff.phone || undefined,
              email: newStaff.email || undefined,
            });
            setNewStaff({ full_name: "", role: "trainer", phone: "", email: "" });
          }}
          className="form-grid"
        >
          <label>
            Full name
            <input value={newStaff.full_name} onChange={(event) => setNewStaff((previous) => ({ ...previous, full_name: event.target.value }))} required />
          </label>
          <label>
            Role
            <select value={newStaff.role} onChange={(event) => setNewStaff((previous) => ({ ...previous, role: event.target.value as StaffRole }))}>
              <option value="management">Management</option>
              <option value="trainer">Trainer</option>
              <option value="sales">Sales</option>
            </select>
          </label>
          <label>
            Phone
            <input value={newStaff.phone} onChange={(event) => setNewStaff((previous) => ({ ...previous, phone: event.target.value }))} />
          </label>
          <label>
            Email
            <input value={newStaff.email} onChange={(event) => setNewStaff((previous) => ({ ...previous, email: event.target.value }))} />
          </label>
          <button type="submit">Create Staff</button>
        </form>
      </article>

      <article className="panel">
        <h2>Trainer Schedule Slot</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onCreateSchedule(newSchedule);
          }}
          className="form-grid"
        >
          <label>
            Trainer
            <select value={newSchedule.trainer_id} onChange={(event) => setNewSchedule((previous) => ({ ...previous, trainer_id: Number(event.target.value) }))}>
              {trainers.map((trainer) => (
                <option key={trainer.id} value={trainer.id}>
                  {trainer.full_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Weekday
            <select value={newSchedule.weekday} onChange={(event) => setNewSchedule((previous) => ({ ...previous, weekday: Number(event.target.value) }))}>
              {WEEKDAY_LABELS.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Start time
            <input type="time" value={newSchedule.start_time} onChange={(event) => setNewSchedule((previous) => ({ ...previous, start_time: event.target.value }))} />
          </label>
          <label>
            End time
            <input type="time" value={newSchedule.end_time} onChange={(event) => setNewSchedule((previous) => ({ ...previous, end_time: event.target.value }))} />
          </label>
          <button type="submit">Add Slot</button>
        </form>
      </article>

      <article className="panel span-two">
        <h2>Assign Personal Trainer</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onCreateAssignment({
              member_id: newAssignment.member_id,
              trainer_id: newAssignment.trainer_id,
              start_date: newAssignment.start_date,
              end_date: newAssignment.end_date || undefined,
              is_active: newAssignment.is_active,
            });
          }}
          className="form-grid"
        >
          <label>
            Member
            <select value={newAssignment.member_id} onChange={(event) => setNewAssignment((previous) => ({ ...previous, member_id: Number(event.target.value) }))}>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Trainer
            <select value={newAssignment.trainer_id} onChange={(event) => setNewAssignment((previous) => ({ ...previous, trainer_id: Number(event.target.value) }))}>
              {trainers.map((trainer) => (
                <option key={trainer.id} value={trainer.id}>
                  {trainer.full_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Start date
            <input type="date" value={newAssignment.start_date} onChange={(event) => setNewAssignment((previous) => ({ ...previous, start_date: event.target.value }))} />
          </label>
          <label>
            End date
            <input type="date" value={newAssignment.end_date} onChange={(event) => setNewAssignment((previous) => ({ ...previous, end_date: event.target.value }))} />
          </label>
          <button type="submit">Assign Trainer</button>
        </form>
      </article>

      <article className="panel">
        <h2>Staff List</h2>
        <ul className="compact-list">
          {staff.map((person) => (
            <li key={person.id}>
              <strong>{person.full_name}</strong> - {person.role}
            </li>
          ))}
        </ul>
      </article>

      <article className="panel">
        <h2>Personal Trainer Connections</h2>
        <ul className="compact-list">
          {assignments.map((assignment) => (
            <li key={assignment.id}>
              {memberNameById[assignment.member_id] ?? assignment.member_id} ↔ {trainerNameById[assignment.trainer_id] ?? assignment.trainer_id}
              <div className="muted">{assignment.start_date} {assignment.end_date ? `to ${assignment.end_date}` : "(ongoing)"}</div>
            </li>
          ))}
        </ul>
      </article>

      <article className="panel span-two">
        <h2>Trainer Weekly Schedules</h2>
        <div className="schedule-grid">
          {trainers.map((trainer) => (
            <div key={trainer.id} className="schedule-card">
              <h3>{trainer.full_name}</h3>
              <ul className="compact-list">
                {(schedules[trainer.id] ?? []).map((slot) => (
                  <li key={slot.id}>
                    {WEEKDAY_LABELS[slot.weekday]}: {slot.start_time} - {slot.end_time}
                  </li>
                ))}
                {(schedules[trainer.id] ?? []).length === 0 && <li className="muted">No slots configured</li>}
              </ul>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

export default App;
