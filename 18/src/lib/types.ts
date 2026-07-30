
import type { CSSProperties } from 'react';

export type Bay = 'Green' | 'Blue' | 'Orange' | 'Purple' | 'Fulfillment' | 'Pre-Blending';

export const BAYS: Bay[] = ['Blue', 'Green', 'Orange', 'Purple', 'Fulfillment', 'Pre-Blending'];

type BayColor = {
  base: string;
  text: string;
  border: string;
};

export const BAY_COLORS: Record<Bay, BayColor> = {
  Blue: {
    base: 'bg-blue-400',
    text: 'text-white',
    border: 'border-blue-700',
  },
  Green: {
    base: 'bg-green-400',
    text: 'text-white',
    border: 'border-green-700',
  },
  Orange: {
    base: 'bg-orange-400',
    text: 'text-white',
    border: 'border-orange-700',
  },
  Purple: {
    base: 'bg-purple-400',
    text: 'text-white',
    border: 'border-purple-700',
  },
  Fulfillment: {
    base: 'bg-yellow-300',
    text: 'text-black',
    border: 'border-yellow-600',
  },
  'Pre-Blending': {
    base: 'bg-teal-200',
    text: 'text-black',
    border: 'border-teal-500',
  },
};


export interface Product {
  id: string;
  name: string;
  coPacker: string;
  coPackerColor: string;
  allergens: string;
  targetDepositWeight?: string;
  targetFinishedWeight?: string;
  batchSizeLbs?: string;
  yieldPerBatch?: string;
  sopFile?: string; // Stored as a data URI
  sopFileName?: string;
  machineryIds?: string[];
  batchesPricedFor1BayDay?: string;
  ftesPricedFor1BayDay?: string;
}

export interface Machine {
  id: string;
  name: string;
  quantity: number;
}

export interface PrepStep {
  id: string;
  name: string;
  daysInAdvance: number;
  productIds: string[];
}

export interface ProductionItem {
  id: string;
  productId: string;
  batches: string;
}

export interface DayProduction {
  [key: string]: ProductionItem[]; // Key is Bay
}

export interface ProductionSchedule {
  [key:string]: DayProduction; // Key is date string 'yyyy-MM-dd'
}

export type CalendarNote = Record<string, { 
    note?: string; 
    timeLeftBuilding?: string 
}>;


export interface Task {
  id: string;
  name: string;
}

export interface User {
  id: string;
  uid?: string; // Firebase Auth UID
  name: string;
  pin: string;
  role: 'admin' | 'bank' | 'employee' | 'miffy';
}

export interface TaskAssignment {
  id: string;
  taskId: string;
  employeeIds: string[];
  hidden: boolean;
}

export interface DayAssignment {
  [key: string]: TaskAssignment[]; // Key is Bay
}

export interface Assignments {
  [key: string]: DayAssignment; // Key is date string 'yyyy-MM-dd'
}

export interface TaskGroup {
  id: string;
  name: string;
  taskIds: string[];
}

export type UserRole = 'admin' | 'bank' | 'employee' | 'miffy' | null;

export type ScrollSpeed = 'slow' | 'normal' | 'fast' | 'faster' | 'very fast';
export type ViewMode = 'desktop' | 'phone';

// Staffing types
export type AvailabilitySlot = {
  start: string;
  end: string;
  confirmed: boolean;
}
export type DayAvailability = { [employeeId: string]: AvailabilitySlot[] }; // employeeId is user.id
export type Availability = { [date: string]: DayAvailability }; // date is 'yyyy-MM-dd'

export type DayConfirmedHours = { [employeeId: string]: string[] }; // employeeId is user.id
export type ConfirmedHours = { [date: string]: DayConfirmedHours }; // date is 'yyyy-MM-dd'

export type ShoppingListCategory = 'Ingredients' | 'Packaging' | 'Cleaning Supplies';

export interface ShoppingListItem {
    id: string;
    category: ShoppingListCategory;
    name: string;
    quantity: string;
    supplier: string;
    leadTime: string;
    needDeliveredBy: string | null;
    ordered: boolean;
    expectedDeliveryDate: string | null;
}

export interface RegisteredShoppingItem {
    id: string;
    category: ShoppingListCategory;
    name: string;
    supplier: string;
    leadTime: string;
}

export interface PalletStorageEntry {
    id: string;
    clientId: string; // Co-packer name
    weekKey: string;  // e.g., '2024-W10'
    dryPallets: number;
    tallDryPallets: number;
    frozenPallets: number;
    tallFrozenPallets: number;
    rebuilds: number;
}

export interface PalletClient {
    id: string;
    name: string;
}

export interface ProcessTimeEntry {
    id: string;
    clientId: string; // Co-packer name
    processName: string;
    minEmployees: string;
    minRate: string;
}

export interface UserNotification {
  id: string;
  targetUserId: string;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  type?: string;
}

export interface PendingStaffingNotification {
  id: string;
  employeeId: string;
  employeeName: string;
  weekRangeStr: string;
  scheduledTime: number;
  notifiedAdminIds: string[];
}

export interface AppSettings {
    calendarColumnWidths: number[];
}

export interface ManagementChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface ManagementNote {
  id: string;
  subject: string;
  date: string;
  body: string;
  labels: string[];
  checklist?: ManagementChecklistItem[];
  createdAt: number;
  updatedAt: number;
  authorName?: string;
}

export interface ProductionContextType {
  isDataLoading: boolean; 
  products: Product[];
  addOrUpdateProduct: (product: Product, syncColor?: boolean) => void;
  deleteProduct: (productId: string) => void;
  deleteAllProducts: () => void;
  tasks: Task[];
  addOrUpdateTask: (task: Task) => void;
  deleteTask: (taskId: string) => void;
  deleteAllTasks: () => void;
  machinery: Machine[];
  addOrUpdateMachine: (machine: Machine) => void;
  deleteMachine: (machineId: string) => void;
  taskGroups: TaskGroup[];
  addOrUpdateTaskGroup: (taskGroup: TaskGroup) => void;
  deleteTaskGroup: (taskGroupId: string) => void;
  deleteAllTaskGroups: () => void;
  prepSteps: PrepStep[];
  addOrUpdatePrepStep: (prepStep: PrepStep) => void;
  deletePrepStep: (prepStepId: string) => void;
  deleteAllPrepSteps: () => void;
  schedule: ProductionSchedule;
  setSchedule: (schedule: ProductionSchedule) => void;
  updateSchedule: (date: string, bay: Bay, items: ProductionItem[], oldDateKey?: string, oldBay?: Bay, isDuplication?: boolean) => void;
  mergeSchedule: (importedSchedule: ProductionSchedule, notes?: Record<string, Partial<CalendarNote[string]>>) => void;
  clearSchedule: () => void;
  calendarNotes: CalendarNote;
  setCalendarNote: (dateKey: string, note?: string, timeLeftBuilding?: string) => void;
  assignments: Assignments;
  updateAssignments: (date: string, bay: Bay, newAssignments: TaskAssignment[]) => void;
  
  // Pallet Storage
  palletStorage: PalletStorageEntry[];
  addOrUpdatePalletStorage: (entry: PalletStorageEntry) => void;
  bulkAddPalletStorage: (entries: PalletStorageEntry[]) => void;
  palletClients: PalletClient[];
  addOrUpdatePalletClient: (client: PalletClient) => void;
  deletePalletClient: (id: string) => void;

  // Process Times
  processTimes: ProcessTimeEntry[];
  addOrUpdateProcessTime: (entry: ProcessTimeEntry) => void;
  deleteProcessTime: (id: string) => void;
  bulkAddProcessTimes: (entries: ProcessTimeEntry[]) => void;

  // User/Auth context
  userRole: UserRole;
  userName: string | null;
  userId: string | null;
  login: (role: UserRole, name: string, id: string) => void;
  logout: () => void;
  users: User[];
  addOrUpdateUser: (user: User) => void;
  deleteUser: (userId: string) => void;
  deleteAllUsers: () => void;
  
  // Staffing context
  availability: Availability;
  setEmployeeAvailability: (employeeId: string, date: string, slots: { start: string, end: string }[]) => void;
  confirmEmployeeAvailabilitySlot: (employeeId: string, date: string, slot: AvailabilitySlot) => void;
  confirmedHours: ConfirmedHours;
  setConfirmedHoursForDay: (employeeId: string, date: string, hours: string[]) => void;
  clearAvailabilityData: () => Promise<void>;
  clearConfirmedHoursData: () => Promise<void>;

  // HR Notes context
  hrNotes: Record<string, Record<string, string>>;
  setEmployeeHrNote: (employeeId: string, date: string, note: string) => void;

  // Staffing Notification Settings
  notifiedAdminIds: string[];
  setNotifiedAdminIds: (adminIds: string[]) => void;
  notificationDelayHours: number;
  setNotificationDelayHours: (hours: number) => void;

  // User Notifications context
  userNotifications: UserNotification[];
  addUserNotification: (targetUserId: string, title: string, body: string, type?: string) => Promise<void>;
  markNotificationRead: (id: string) => void;

  // Shopping List context
  shoppingList: ShoppingListItem[];
  setShoppingList: (items: ShoppingListItem[]) => void;
  addShoppingListItem: (item: ShoppingListItem) => void;
  updateShoppingListItem: (item: ShoppingListItem) => void;
  removeShoppingListItem: (id: string) => void;
  registeredShoppingItems: RegisteredShoppingItem[];
  addRegisteredShoppingItems: (items: Omit<RegisteredShoppingItem, 'id'>[]) => void;
  clearRegisteredShoppingItems: (category: ShoppingListCategory) => void;
  removeRegisteredShoppingItem: (id: string) => void;
  addOrUpdateRegisteredShoppingItem: (item: Omit<RegisteredShoppingItem, 'id'> | RegisteredShoppingItem) => void;


  // App Settings
  settings: AppSettings | null;
  setCalendarColumnWidths: (widths: number[] | ((prevState: number[]) => number[])) => void;

  // UI State
  assignedTasksDate: Date;
  setAssignedTasksDate: (date: Date) => void;
  assignedTasksIsScrolling: boolean;
  setAssignedTasksIsScrolling: (isScrolling: boolean) => void;
  assignedTasksScrollSpeed: ScrollSpeed;
  setAssignedTasksScrollSpeed: (speed: ScrollSpeed) => void;

  // Management Notes context
  managementNotes: ManagementNote[];
  addOrUpdateManagementNote: (note: ManagementNote) => Promise<void>;
  deleteManagementNote: (noteId: string) => Promise<void>;
  toggleManagementChecklistItem: (noteId: string, itemId: string) => Promise<void>;
}
