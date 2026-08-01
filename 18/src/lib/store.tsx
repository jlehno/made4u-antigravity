
"use client";
import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import type { ProductionContextType, Product, Task, ProductionSchedule, Assignments, Bay, ProductionItem, TaskAssignment, User, UserRole, Machine, TaskGroup, ScrollSpeed, Availability, ConfirmedHours, AvailabilitySlot, DayProduction, ShoppingListItem, RegisteredShoppingItem, ShoppingListCategory, CalendarNote, AppSettings, PrepStep, PalletStorageEntry, PalletClient, ProcessTimeEntry, UserNotification, PendingStaffingNotification, ManagementNote } from './types';
import { db, auth, firebaseConfig } from './firebase';
import { initializeApp, deleteApp } from 'firebase/app';
import { collection, doc, getDocs, onSnapshot, setDoc, writeBatch, deleteDoc, addDoc, query, where, getDoc, updateDoc, runTransaction } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, getAuth } from 'firebase/auth';
import { format, startOfWeek, addDays, parse } from 'date-fns';
import { triggerNativeDeviceNotification } from './notifications';

const ProductionContext = createContext<ProductionContextType | undefined>(undefined);

const initialProducts: Product[] = [
  { id: 'prod-1', name: 'Product A', coPacker: 'CP-1', coPackerColor: '#a7f3d0', allergens: 'None', targetDepositWeight: '100g', targetFinishedWeight: '95g', batchSizeLbs: '50', yieldPerBatch: '200', machineryIds: ['machine-1'] },
  { id: 'prod-2', name: 'Product B', coPacker: 'CP-2', coPackerColor: '#bae6fd', allergens: 'Peanuts', targetDepositWeight: '120g', targetFinishedWeight: '110g', batchSizeLbs: '75', yieldPerBatch: '150', machineryIds: ['machine-2'] },
  { id: 'prod-3', name: 'Product C', coPacker: 'CP-1', coPackerColor: '#a7f3d0', allergens: 'Dairy', targetDepositWeight: '80g', targetFinishedWeight: '75g', batchSizeLbs: '60', yieldPerBatch: '250', machineryIds: ['machine-1', 'machine-3'] },
];
const initialTasks: Task[] = [
    { id: 'task-1', name: 'Mixing' },
    { id: 'task-2', name: 'Baking' },
    { id: 'task-3', name: 'Packaging' },
    { id: 'task-4', name: 'Quality Check' },
];
const initialMachinery: Machine[] = [
    { id: 'machine-1', name: 'Mixer A', quantity: 2 },
    { id: 'machine-2', name: 'Oven B', quantity: 1 },
    { id: 'machine-3', name: 'Packaging Line C', quantity: 3 },
];
const initialTaskGroups: TaskGroup[] = [
    { id: 'tg-1', name: 'Standard Bake', taskIds: ['task-1', 'task-2', 'task-4'] },
    { id: 'tg-2', name: 'Pack Only', taskIds: ['task-3', 'task-4'] },
];
const initialUsers: User[] = [
  { id: 'user-1', name: 'Joshua Lehn', pin: '310101', role: 'admin' },
  { id: 'user-2', name: 'Jesse Lehn', pin: '010129', role: 'admin' },
  { id: 'user-3', name: 'Adeline Lehn', pin: '320101', role: 'admin' },
  { id: 'user-4', name: 'Christopher Lehn', pin: '460101', role: 'admin' },
  { id: 'user-5', name: 'Tammy Lehn', pin: '420101', role: 'admin' },
  { id: 'user-6', name: 'Community Banks of Colorado', pin: '444444', role: 'bank' },
  { id: 'user-7', name: 'John Smith', pin: '654321', role: 'employee' },
];
const initialSettings: AppSettings = {
    calendarColumnWidths: Array(7).fill(150),
};


export const ProductionProvider = ({ children }: { children: ReactNode }) => {
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [machinery, setMachinery] = useState<Machine[]>([]);
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);
  const [prepSteps, setPrepSteps] = useState<PrepStep[]>([]);
  const [schedule, setSchedule] = useState<ProductionSchedule>({});
  const [assignments, setAssignments] = useState<Assignments>({});
  const [availability, setAvailability] = useState<Availability>({});
  const [confirmedHours, setConfirmedHours] = useState<ConfirmedHours>({});
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);
  const [registeredShoppingItems, setRegisteredShoppingItems] = useState<RegisteredShoppingItem[]>([]);
  const [palletStorage, setPalletStorage] = useState<PalletStorageEntry[]>([]);
  const [palletClients, setPalletClients] = useState<PalletClient[]>([]);
  const [processTimes, setProcessTimes] = useState<ProcessTimeEntry[]>([]);
  const [calendarNotes, setCalendarNotes] = useState<CalendarNote>({});
  const [hrNotes, setHrNotes] = useState<Record<string, Record<string, string>>>({});
  const [notifiedAdminIds, setNotifiedAdminIdsState] = useState<string[]>([]);
  const [notificationDelayHours, setNotificationDelayHoursState] = useState<number>(0);
  const [userNotifications, setUserNotifications] = useState<UserNotification[]>([]);
  const [pendingStaffingNotifications, setPendingStaffingNotifications] = useState<PendingStaffingNotification[]>([]);
  const [managementNotes, setManagementNotes] = useState<ManagementNote[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  
  const [assignedTasksDate, setAssignedTasksDate] = useState<Date>(new Date());
  const [assignedTasksIsScrolling, setAssignedTasksIsScrolling] = useState<boolean>(false);
  const [assignedTasksScrollSpeed, setAssignedTasksScrollSpeed] = useState<ScrollSpeed>('normal');
  const [staffingDate, setStaffingDate] = useState<Date>(new Date());

  const addOrUpdateUser = useCallback(async (user: User, isSeeding = false) => {
    const userDocRef = doc(db, 'employees', user.id);
    const email = `${user.name.replace(/\s+/g, '.').toLowerCase()}@productionflow.app`;
    
    let uid: string | undefined = user.uid;
    
    if (!uid) {
        // Create secondary temp app to avoid signing out the current admin
        const tempAppName = `temp-app-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        try {
            const tempApp = initializeApp(firebaseConfig, tempAppName);
            const tempAuth = getAuth(tempApp);
            try {
                const userCredential = await createUserWithEmailAndPassword(tempAuth, email, user.pin);
                uid = userCredential.user.uid;
            } catch (createError: any) {
                if (createError.code === 'auth/email-already-in-use') {
                    console.log(`Auth user for ${email} already exists.`);
                    try {
                        const userCredential = await signInWithEmailAndPassword(tempAuth, email, user.pin);
                        uid = userCredential.user.uid;
                    } catch (signInError: any) {
                        console.log(`User exists but PIN is different or sign in failed:`, signInError);
                    }
                } else {
                    console.error(`Failed to create auth user for ${user.name}:`, createError);
                }
            }
            await deleteApp(tempApp);
        } catch (appError) {
            console.error("Temp app error:", appError);
        }
    }

    const updatedUser = uid ? { ...user, uid } : user;
    await setDoc(userDocRef, updatedUser, { merge: true });
  }, []);

  useEffect(() => {
    const seedInitialData = async () => {
        const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
        if (!settingsDoc.exists()) {
            console.log("No global settings found, seeding initial data...");
            const batch = writeBatch(db);

            initialProducts.forEach(prod => batch.set(doc(db, 'products', prod.id), prod));
            initialTasks.forEach(task => batch.set(doc(db, 'tasks', task.id), task));
            initialMachinery.forEach(m => batch.set(doc(db, 'machinery', m.id), m));
            initialTaskGroups.forEach(tg => batch.set(doc(db, 'taskGroups', tg.id), tg));
            batch.set(doc(db, 'settings', 'global'), initialSettings);
            
            await batch.commit();

            for (const user of initialUsers) {
               await addOrUpdateUser(user, true);
            }
            console.log("Initial data seeding complete.");
        }
    };


    seedInitialData().catch(console.error);

    const unsubUsers = onSnapshot(collection(db, 'employees'), (snap) => {
      setUsers(snap.docs.map(d => {
        const data = d.data();
        let role = data.role;
        if (!role) {
          const name = data.name || '';
          if (['Joshua Lehn', 'Jesse Lehn', 'Adeline Lehn', 'Christopher Lehn', 'Tammy Lehn'].includes(name)) {
            role = 'admin';
          } else if (name === 'Community Banks of Colorado') {
            role = 'bank';
          } else {
            role = 'employee';
          }
        }
        return { id: d.id, ...data, role } as User;
      }));
      setIsDataLoading(false);
    }, (error) => {
      console.error("Firestore (employees) initialization failed", error);
      setIsDataLoading(false);
    });
    
    try {
      const storedRole = localStorage.getItem('userRole') as UserRole;
      const storedName = localStorage.getItem('userName');
      const storedId = localStorage.getItem('userId');
      if (storedRole && storedName && storedId) {
        setUserRole(storedRole);
        setUserName(storedName);
        setUserId(storedId);
      }
    } catch (error) {
        console.error("Error reading auth from localStorage:", error);
    }

    return () => {
      unsubUsers();
    };
  }, [addOrUpdateUser]);

  useEffect(() => {
    if (!userRole || !userId) {
        return;
    }
    
    console.log("User authenticated, setting up real-time data listeners...");
    
    const collectionsToSubscribe = [
      { name: 'products', setter: setProducts, isObject: false },
      { name: 'tasks', setter: setTasks, isObject: false },
      { name: 'machinery', setter: setMachinery, isObject: false },
      { name: 'taskGroups', setter: setTaskGroups, isObject: false },
      { name: 'prepSteps', setter: setPrepSteps, isObject: false },
      { name: 'schedule', setter: setSchedule, isObject: true },
      { name: 'taskAssignments', setter: setAssignments, isObject: true },
      { name: 'availability', setter: setAvailability, isObject: true },
      { name: 'confirmedHours', setter: setConfirmedHours, isObject: true },
      { name: 'shoppingList', setter: setShoppingList, isObject: false },
      { name: 'registeredShoppingItems', setter: setRegisteredShoppingItems, isObject: false },
      { name: 'calendarNotes', setter: setCalendarNotes, isObject: true },
      { name: 'palletStorage', setter: setPalletStorage, isObject: false },
      { name: 'palletClients', setter: setPalletClients, isObject: false },
      { name: 'processTimes', setter: setProcessTimes, isObject: false },
      { name: 'hrNotes', setter: setHrNotes, isObject: true },
      { name: 'userNotifications', setter: setUserNotifications, isObject: false },
      { name: 'pendingStaffingNotifications', setter: setPendingStaffingNotifications, isObject: false },
      { name: 'managementNotes', setter: setManagementNotes, isObject: false },
    ];
    
    const unsubscribers = collectionsToSubscribe.map(colInfo => {
      // FIX: Correctly pass 'db' as the first argument to collection()
      return onSnapshot(collection(db, colInfo.name), (snap) => {
        if (colInfo.isObject) {
            const newData = {} as any;
            snap.forEach(doc => { newData[doc.id] = doc.data() as any; });
            (colInfo.setter as (data: any) => void)(newData);
        } else {
            (colInfo.setter as (data: any) => void)(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      }, (error) => {
          console.error(`Firestore (${colInfo.name}) initialization failed`, error);
      });
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
        if (docSnap.exists()) {
            setSettings(docSnap.data() as AppSettings);
        }
    });
    unsubscribers.push(unsubSettings);

    const unsubStaffingSettings = onSnapshot(doc(db, 'settings', 'staffingNotifications'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (Array.isArray(data.notifiedAdminIds)) {
          setNotifiedAdminIdsState(data.notifiedAdminIds);
        }
        if (typeof data.notificationDelayHours === 'number') {
          setNotificationDelayHoursState(data.notificationDelayHours);
        }
      }
    });
    unsubscribers.push(unsubStaffingSettings);

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [userRole, userId]);

  // Background processing of pending staffing notifications
  useEffect(() => {
    if (pendingStaffingNotifications.length === 0) return;

    const checkAndProcessNotifications = async () => {
      const now = Date.now();
      const expiredNotifications = pendingStaffingNotifications.filter(pn => now >= pn.scheduledTime);
      
      for (const pn of expiredNotifications) {
        const pendingRef = doc(db, 'pendingStaffingNotifications', pn.id);
        try {
          let successData: any = null;
          // Use transaction to ensure exactly one client dispatches the notification and deletes the pending entry
          await runTransaction(db, async (transaction) => {
            const pendingDoc = await transaction.get(pendingRef);
            if (pendingDoc.exists()) {
              const data = pendingDoc.data();
              // Re-check scheduledTime and existence inside the transaction
              if (now >= data.scheduledTime) {
                transaction.delete(pendingRef);
                successData = data;
              }
            }
          });

          if (successData) {
            const { employeeName, weekRangeStr, notifiedAdminIds: recordAdminIds } = successData;
            const adminUsers = users.filter(u => u.role === 'admin');
            const adminUserIds = adminUsers.map(u => u.id);
            const targetAdminIds = (recordAdminIds && recordAdminIds.length > 0)
              ? recordAdminIds
              : ((notifiedAdminIds && notifiedAdminIds.length > 0) ? notifiedAdminIds : adminUserIds);

            if (targetAdminIds && targetAdminIds.length > 0) {
              for (const adminId of targetAdminIds) {
                await addUserNotification(
                  adminId,
                  'Staffing Availability Updated',
                  `${employeeName}: Adjusted Available Hours Week (${weekRangeStr})`,
                  'availability_adjusted'
                );
              }
            }
          }
        } catch (err) {
          // Expected to fail silently if another client beat us to it
          console.debug("Pending notification already dispatched or transaction failed:", err);
        }
      }
    };

    // Run immediately on update/mount
    checkAndProcessNotifications();

    // Run periodically
    const interval = setInterval(checkAndProcessNotifications, 5000);

    // Listen to tab focus/visibility changes to wake up from mobile sleep instantly
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAndProcessNotifications();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pendingStaffingNotifications]);


  const login = (role: UserRole, name: string, id: string) => {
    if(role && name && id) {
      localStorage.setItem('userRole', role);
      setUserRole(role);
      localStorage.setItem('userName', name);
      setUserName(name);
      localStorage.setItem('userId', id);
      setUserId(id);
    }
  }

  const logout = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
    setUserRole(null);
    setUserName(null);
    setUserId(null);
  }
  
  const deleteDocument = async (collectionName: string, id: string) => {
    await deleteDoc(doc(db, collectionName, id));
  }
  
  const deleteAllDocsInCollection = async (collectionName: string, protectedIds: string[] = []) => {
      const snap = await getDocs(collection(db, collectionName));
      const batch = writeBatch(db);
      snap.docs.forEach(d => {
          if (!protectedIds.includes(d.id)) {
              batch.delete(d.ref);
          }
      });
      await batch.commit();
  }
  
  const updateSchedule = async (dateKey: string, bay: Bay, items: ProductionItem[], oldDateKey?: string, oldBay?: Bay, isDuplication: boolean = false) => {
    const batch = writeBatch(db);

    const getDayData = async (dKey: string): Promise<DayProduction> => {
        const dateRef = doc(db, 'schedule', dKey);
        const dateSnap = await getDoc(dateRef);
        return (dateSnap.exists() ? dateSnap.data() : {}) as DayProduction;
    };
    
    const updateDayData = (dKey: string, dayData: DayProduction) => {
        const dateRef = doc(db, 'schedule', dKey);
        if (Object.keys(dayData).filter(k => dayData[k]?.length > 0).length === 0) {
            batch.delete(dateRef);
        } else {
            batch.set(dateRef, dayData);
        }
    };
    
    if (oldDateKey && oldBay && dateKey && bay) {
        const movedItem = items[0]; 
        const oldDayData = await getDayData(oldDateKey);
        if (oldDayData[oldBay]) {
            oldDayData[oldBay] = oldDayData[oldBay].filter(item => item.id !== movedItem.id);
            if (oldDayData[oldBay].length === 0) delete oldDayData[oldBay];
        }
        updateDayData(oldDateKey, oldDayData);
        const newDayData = oldDateKey === dateKey ? oldDayData : await getDayData(dateKey);
        if (!newDayData[bay]) newDayData[bay] = [];
        const itemExistsInNewBay = newDayData[bay].some(i => i.id === movedItem.id);
        if (!itemExistsInNewBay) {
             newDayData[bay].push(movedItem);
        }
        updateDayData(dateKey, newDayData);
    } else if (isDuplication) {
        const dayData = await getDayData(dateKey);
        dayData[bay] = [...(dayData[bay] || []), ...items];
        updateDayData(dateKey, dayData);
    } else {
        const dayData = await getDayData(dateKey);
        dayData[bay] = items;
        if(dayData[bay]?.length === 0) delete dayData[bay];
        updateDayData(dateKey, dayData);
    }
    await batch.commit();
  };

  const bulkUpdateSchedule = async (updates: { dateKey: string; bay: Bay; items: ProductionItem[] }[]) => {
    if (updates.length === 0) return;
    const batch = writeBatch(db);

    const updatesByDate: Record<string, Record<Bay, ProductionItem[]>> = {};

    updates.forEach(({ dateKey, bay, items }) => {
      if (!updatesByDate[dateKey]) {
        updatesByDate[dateKey] = {} as Record<Bay, ProductionItem[]>;
      }
      if (!updatesByDate[dateKey][bay]) {
        updatesByDate[dateKey][bay] = [];
      }
      updatesByDate[dateKey][bay].push(...items);
    });

    for (const [dateKey, bayMap] of Object.entries(updatesByDate)) {
      const dateRef = doc(db, 'schedule', dateKey);
      const dateSnap = await getDoc(dateRef);
      const dayData = (dateSnap.exists() ? dateSnap.data() : {}) as DayProduction;

      Object.entries(bayMap).forEach(([bayStr, newItems]) => {
        const bay = bayStr as Bay;
        dayData[bay] = [...(dayData[bay] || []), ...newItems];
      });

      batch.set(dateRef, dayData);
    }

    await batch.commit();
  };

  const bulkReplaceSchedule = async (updates: { dateKey: string; bay: Bay; items: ProductionItem[] }[]) => {
    if (updates.length === 0) return;
    const batch = writeBatch(db);

    const updatesByDate: Record<string, Record<Bay, ProductionItem[]>> = {};

    updates.forEach(({ dateKey, bay, items }) => {
      if (!updatesByDate[dateKey]) {
        updatesByDate[dateKey] = {} as Record<Bay, ProductionItem[]>;
      }
      updatesByDate[dateKey][bay] = items;
    });

    for (const [dateKey, bayMap] of Object.entries(updatesByDate)) {
      const dateRef = doc(db, 'schedule', dateKey);
      const dateSnap = await getDoc(dateRef);
      const dayData = (dateSnap.exists() ? dateSnap.data() : {}) as DayProduction;

      Object.entries(bayMap).forEach(([bayStr, items]) => {
        const bay = bayStr as Bay;
        if (items && items.length > 0) {
          dayData[bay] = items;
        } else {
          delete dayData[bay];
        }
      });

      if (Object.keys(dayData).filter(k => dayData[k as Bay]?.length > 0).length === 0) {
        batch.delete(dateRef);
      } else {
        batch.set(dateRef, dayData);
      }
    }

    await batch.commit();
  };
  
  const mergeSchedule = async (importedSchedule: ProductionSchedule, notes?: Record<string, Partial<CalendarNote[string]>>) => {
      const batch = writeBatch(db);
      for (const [date, dayProduction] of Object.entries(importedSchedule)) {
          const docRef = doc(db, 'schedule', date);
          batch.set(docRef, dayProduction, { merge: true });
      }
      if (notes) {
          for (const [date, noteData] of Object.entries(notes)) {
              if (noteData.note || noteData.timeLeftBuilding) {
                  const noteRef = doc(db, 'calendarNotes', date);
                  batch.set(noteRef, noteData, { merge: true });
              }
          }
      }
      await batch.commit();
  };
  
  const clearSchedule = () => {
    deleteAllDocsInCollection('schedule');
    deleteAllDocsInCollection('calendarNotes');
  }

  const setCalendarNote = async (dateKey: string, note?: string, timeLeftBuilding?: string) => {
    const noteRef = doc(db, 'calendarNotes', dateKey);
    const dataToSet: Partial<CalendarNote[string]> = {};
    let shouldDelete = true;

    if (note !== undefined && note !== null) {
      dataToSet.note = note;
      if(note.trim() !== '') shouldDelete = false;
    }
    
    if (timeLeftBuilding !== undefined && timeLeftBuilding !== null) {
        dataToSet.timeLeftBuilding = timeLeftBuilding;
        if(timeLeftBuilding.trim() !== '') shouldDelete = false;
    }

    if (shouldDelete) {
        await deleteDoc(noteRef);
    } else {
        await setDoc(noteRef, dataToSet, { merge: true });
    }
  };

  const updateAssignments = (date: string, bay: Bay, newAssignments: TaskAssignment[]) => {
      setDoc(doc(db, 'taskAssignments', date), { [bay]: newAssignments }, { merge: true });
  };
  
  const setEmployeeAvailability = async (employeeId: string, date: string, slots: { start: string, end: string }[]) => {
      const currentDayAvailability = availability[date]?.[employeeId] || [];
      const confirmedSlots = currentDayAvailability.filter(s => s.confirmed);
      
      // Filter out slots that are already confirmed to avoid duplicate entries
      const newEditableSlots = slots
        .filter(s => !confirmedSlots.some(cs => cs.start === s.start && cs.end === s.end))
        .map(s => ({ ...s, confirmed: false }));
        
      const mergedSlots = [...confirmedSlots, ...newEditableSlots];
      await setDoc(doc(db, 'availability', date), { [employeeId]: mergedSlots }, { merge: true });

      // Trigger debounced notification tracking for Admin Staffing Notification Settings
      try {
        const emp = users.find(u => u.id === employeeId);
        const empName = emp ? emp.name : 'Employee';
        let parsedDate = new Date();
        if (date) {
          const parts = date.split('-');
          if (parts.length === 3) {
            parsedDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          }
        }
        const startWeek = startOfWeek(parsedDate, { weekStartsOn: 1 });
        const endWeek = addDays(startWeek, 6);
        const weekRangeStr = `${format(startWeek, 'M/d')}-${format(endWeek, 'M/d')}`;

        // Target admins: if specific admins configured, use them; otherwise default to ALL admin users
        const adminUsers = users.filter(u => u.role === 'admin');
        const adminUserIds = adminUsers.map(u => u.id);
        const targetAdminIds = (notifiedAdminIds && notifiedAdminIds.length > 0)
          ? notifiedAdminIds
          : adminUserIds;

        if (targetAdminIds.length > 0) {
          const delayHours = notificationDelayHours !== undefined ? notificationDelayHours : 0;
          const delayMs = delayHours * 60 * 60 * 1000;
          const scheduledTime = Date.now() + delayMs;

          if (delayMs > 0) {
            // Write/update the pending staffing notification record in Firestore
            await setDoc(doc(db, 'pendingStaffingNotifications', employeeId), {
              id: employeeId,
              employeeId,
              employeeName: empName,
              weekRangeStr,
              scheduledTime,
              notifiedAdminIds: targetAdminIds
            });
          } else {
            // Send immediately to target admin devices
            for (const adminId of targetAdminIds) {
              await addUserNotification(
                adminId,
                'Staffing Availability Updated',
                `${empName}: Adjusted Available Hours Week (${weekRangeStr})`,
                'availability_adjusted'
              );
            }
          }
        }
      } catch (err) {
        console.error("Error setting up staffing notification:", err);
      }
  };
  
  const confirmEmployeeAvailabilitySlot = async (employeeId: string, date: string, slotToToggle: AvailabilitySlot) => {
      const dayAvailability = availability[date]?.[employeeId] || [];
      const updatedSlots = dayAvailability.map(s => 
          s.start === slotToToggle.start && s.end === slotToToggle.end 
          ? { ...s, confirmed: !s.confirmed } : s
      );
      
      await setDoc(doc(db, 'availability', date), { [employeeId]: updatedSlots }, { merge: true });

      // Automatically sync confirmed availability slots to confirmedHours!
      const confirmedSlots = updatedSlots.filter(s => s.confirmed);
      const hoursArray = confirmedSlots.map(s => `${s.start}-${s.end}`);
      await setDoc(doc(db, 'confirmedHours', date), { [employeeId]: hoursArray }, { merge: true });

      // Send device notification to employee when their hours are confirmed
      const slotResult = updatedSlots.find(s => s.start === slotToToggle.start && s.end === slotToToggle.end);
      if (slotResult && slotResult.confirmed) {
        try {
          let parsedDate = new Date();
          const parts = date.split('-');
          if (parts.length === 3) {
            parsedDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          }
          const formattedDate = format(parsedDate, 'M/d');
          await addUserNotification(
            employeeId,
            'Hours Confirmed',
            `Hours confirmed for ${formattedDate}`,
            'hours_confirmed'
          );
        } catch (err) {
          console.error("Error sending hours confirmed notification:", err);
        }
      }
  };

  const normalizeTime = (t: string): string => {
    if (!t) return '';
    let clean = t.toLowerCase().replace(/\s+/g, '');
    if (/^\d+(am|pm)$/.test(clean)) {
      clean = clean.replace(/^(\d+)/, '$1:00');
    }
    if (clean.startsWith('0')) {
      clean = clean.substring(1);
    }
    return clean;
  };

  const normalizeSlotString = (slotStr: string): string => {
    const parts = slotStr.split('-');
    if (parts.length !== 2) return slotStr;
    return `${normalizeTime(parts[0])}-${normalizeTime(parts[1])}`;
  };

  const setConfirmedHoursForDay = async (employeeId: string, date: string, hours: string[]) => {
      await setDoc(doc(db, 'confirmedHours', date), { [employeeId]: hours }, { merge: true });

      // Sync confirmedHours changes back to availability slots!
      const normalizedConfirmed = hours.map(normalizeSlotString);
      const dayAvailability = availability[date]?.[employeeId] || [];
      
      const updatedSlots = [...dayAvailability];
      const normalizedExisting = dayAvailability.map(slot => normalizeSlotString(`${slot.start}-${slot.end}`));
      
      // Update existing slots' confirmation status
      updatedSlots.forEach((slot, index) => {
          const slotStr = `${slot.start}-${slot.end}`;
          const isConfirmed = normalizedConfirmed.includes(normalizeSlotString(slotStr));
          updatedSlots[index] = { ...slot, confirmed: isConfirmed };
      });

      // Add any custom confirmed hours that don't exist as availability slots
      hours.forEach(hourStr => {
          const normHour = normalizeSlotString(hourStr);
          if (!normalizedExisting.includes(normHour)) {
              const parts = hourStr.split('-');
              if (parts.length === 2) {
                  updatedSlots.push({
                      start: parts[0].trim(),
                      end: parts[1].trim(),
                      confirmed: true
                  });
              }
          }
      });

      await setDoc(doc(db, 'availability', date), { [employeeId]: updatedSlots }, { merge: true });

      if (hours.length > 0) {
        try {
          let parsedDate = new Date();
          const parts = date.split('-');
          if (parts.length === 3) {
            parsedDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          }
          const formattedDate = format(parsedDate, 'M/d');
          await addUserNotification(
            employeeId,
            'Hours Confirmed',
            `Hours confirmed for ${formattedDate}`,
            'hours_confirmed'
          );
        } catch (err) {
          console.error("Error sending hours confirmed notification:", err);
        }
      }
  };

  const clearAvailabilityData = async () => {
      await deleteAllDocsInCollection('availability');
  };

  const clearConfirmedHoursData = async () => {
      await deleteAllDocsInCollection('confirmedHours');
  };

  const addOrUpdateProduct = useCallback(async (product: Product, syncColor: boolean = false) => {
    const batch = writeBatch(db);
    batch.set(doc(db, 'products', product.id), product, { merge: true });

    if (syncColor && product.coPacker) {
      const q = query(collection(db, 'products'), where('coPacker', '==', product.coPacker));
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((doc) => {
        if (doc.id !== product.id) {
          batch.update(doc.ref, { coPackerColor: product.coPackerColor });
        }
      });
    }

    await batch.commit();
  }, []);
  
  const setCalendarColumnWidths = useCallback(async (widths: number[] | ((prevState: number[]) => number[])) => {
    if (userRole === 'admin') {
        const newWidths = typeof widths === 'function' ? widths(settings?.calendarColumnWidths || Array(7).fill(150)) : widths;
        setSettings(prev => ({...prev, calendarColumnWidths: newWidths} as AppSettings));
        const settingsDocRef = doc(db, 'settings', 'global');
        try {
            await updateDoc(settingsDocRef, { calendarColumnWidths: newWidths });
        } catch(e) {
            console.error("Failed to save column widths to Firestore", e);
        }
    }
  }, [userRole, settings]);

  const addShoppingListItem = (item: ShoppingListItem) => {
      const itemData: any = { ...item };
      if (itemData.needDeliveredBy === undefined) {
        delete itemData.needDeliveredBy;
      }
      setDoc(doc(db, 'shoppingList', item.id), itemData);
  }
  const updateShoppingListItem = (item: ShoppingListItem) => {
      setDoc(doc(db, 'shoppingList', item.id), item, { merge: true });
  }
  const removeShoppingListItem = (id: string) => {
      deleteDoc(doc(db, 'shoppingList', id));
  }
  const reorderShoppingList = async (items: ShoppingListItem[]) => {
      const batch = writeBatch(db);
      const existingSnap = await getDocs(collection(db, 'shoppingList'));
      existingSnap.forEach(doc => batch.delete(doc.ref));
      items.forEach(item => batch.set(doc(db, 'shoppingList', item.id), item));
      await batch.commit();
  }
  
  const addOrUpdateRegisteredShoppingItem = (item: Omit<RegisteredShoppingItem, 'id'> | RegisteredShoppingItem) => {
    if ('id' in item && item.id) {
        setDoc(doc(db, 'registeredShoppingItems', item.id), item, { merge: true });
    } else {
        addDoc(collection(db, 'registeredShoppingItems'), item);
    }
  }

  const removeRegisteredShoppingItem = (id: string) => {
      deleteDoc(doc(db, 'registeredShoppingItems', id));
  }

  const addRegisteredShoppingItems = async (items: Omit<RegisteredShoppingItem, 'id'>[]) => {
    const batch = writeBatch(db);
    items.forEach(item => {
        const docRef = doc(collection(db, 'registeredShoppingItems'));
        batch.set(docRef, item);
    });
    await batch.commit();
  };

  const clearRegisteredShoppingItems = async (category: ShoppingListCategory) => {
    const q = query(collection(db, 'registeredShoppingItems'), where('category', '==', category));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  };

  const addOrUpdatePrepStep = (prepStep: PrepStep) => {
    const docRef = doc(db, 'prepSteps', prepStep.id);
    setDoc(docRef, prepStep, { merge: true }).catch(console.error);
  };

  const deletePrepStep = (id: string) => {
    const docRef = doc(db, 'prepSteps', id);
    deleteDoc(docRef).catch(console.error);
  };

  const deleteAllPrepSteps = async () => {
    const q = query(collection(db, 'prepSteps'));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    batch.commit().catch(console.error);
  };

  const addOrUpdatePalletStorage = (entry: PalletStorageEntry) => {
    setDoc(doc(db, 'palletStorage', entry.id), entry, { merge: true }).catch(console.error);
  };

  const bulkAddPalletStorage = async (entries: PalletStorageEntry[]) => {
    const batch = writeBatch(db);
    entries.forEach(entry => {
        batch.set(doc(db, 'palletStorage', entry.id), entry, { merge: true });
    });
    await batch.commit();
  };

  const addOrUpdatePalletClient = (client: PalletClient) => {
    setDoc(doc(db, 'palletClients', client.id), client, { merge: true }).catch(console.error);
  };

  const deletePalletClient = (id: string) => {
    deleteDoc(doc(db, 'palletClients', id)).catch(console.error);
  };

  const addOrUpdateProcessTime = (entry: ProcessTimeEntry) => {
    setDoc(doc(db, 'processTimes', entry.id), entry, { merge: true }).catch(console.error);
  };

  const deleteProcessTime = (id: string) => {
    deleteDoc(doc(db, 'processTimes', id)).catch(console.error);
  };

  const bulkAddProcessTimes = async (entries: ProcessTimeEntry[]) => {
    const batch = writeBatch(db);
    entries.forEach(entry => {
        batch.set(doc(db, 'processTimes', entry.id), entry, { merge: true });
    });
    await batch.commit();
  };


  const setEmployeeHrNote = async (employeeId: string, date: string, note: string) => {
    await setDoc(doc(db, 'hrNotes', date), { [employeeId]: note }, { merge: true });
  };

  const setNotifiedAdminIds = async (adminIds: string[]) => {
    setNotifiedAdminIdsState(adminIds);
    await setDoc(doc(db, 'settings', 'staffingNotifications'), { notifiedAdminIds: adminIds }, { merge: true });
  };

  const setNotificationDelayHours = async (hours: number) => {
    setNotificationDelayHoursState(hours);
    await setDoc(doc(db, 'settings', 'staffingNotifications'), { notificationDelayHours: hours }, { merge: true });
  };

  const addUserNotification = async (targetUserId: string, title: string, body: string, type: string = 'general') => {
    const docRef = doc(collection(db, 'userNotifications'));
    const notificationData: UserNotification = {
      id: docRef.id,
      targetUserId,
      title,
      body,
      timestamp: Date.now(),
      read: false,
      type,
    };
    await setDoc(docRef, notificationData);

    // Trigger native device notification (Service Worker background/lock screen & desktop API)
    triggerNativeDeviceNotification(title, body, docRef.id).catch(console.error);
  };

  const markNotificationRead = async (id: string) => {
    await updateDoc(doc(db, 'userNotifications', id), { read: true });
  };

  const addOrUpdateManagementNote = useCallback(async (note: ManagementNote) => {
    const noteId = note.id || doc(collection(db, 'managementNotes')).id;
    const cleanChecklist = Array.isArray(note.checklist)
      ? note.checklist.map((item) => ({
          id: String(item.id || `item-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`),
          text: String(item.text || ''),
          completed: Boolean(item.completed),
        }))
      : [];

    const noteData: Record<string, any> = {
      id: String(noteId),
      subject: String(note.subject || ''),
      date: String(note.date || format(new Date(), 'yyyy-MM-dd')),
      body: String(note.body || ''),
      labels: Array.isArray(note.labels) && note.labels.length > 0 ? note.labels.map(String) : ['General'],
      checklist: cleanChecklist,
      createdAt: Number(note.createdAt || Date.now()),
      updatedAt: Date.now(),
      authorName: String(note.authorName || userName || 'Admin'),
    };

    // Remove any accidental undefined fields
    Object.keys(noteData).forEach((key) => {
      if (noteData[key] === undefined) {
        delete noteData[key];
      }
    });

    setManagementNotes((prev) => {
      const idx = prev.findIndex((n) => n.id === noteId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = noteData as ManagementNote;
        return updated;
      }
      return [...prev, noteData as ManagementNote];
    });
    await setDoc(doc(db, 'managementNotes', noteId), noteData);
  }, [userName]);

  const deleteManagementNote = useCallback(async (noteId: string) => {
    setManagementNotes((prev) => prev.filter((n) => n.id !== noteId));
    await deleteDoc(doc(db, 'managementNotes', noteId));
  }, []);

  const toggleManagementChecklistItem = useCallback(async (noteId: string, itemId: string) => {
    setManagementNotes((prev) => {
      const targetNote = prev.find((n) => n.id === noteId);
      if (!targetNote || !targetNote.checklist) return prev;
      const updatedChecklist = targetNote.checklist.map((item) =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      );
      const updatedNote: ManagementNote = { ...targetNote, checklist: updatedChecklist, updatedAt: Date.now() };

      const cleanData: Record<string, any> = {
        id: String(updatedNote.id),
        subject: String(updatedNote.subject || ''),
        date: String(updatedNote.date || ''),
        body: String(updatedNote.body || ''),
        labels: updatedNote.labels || ['General'],
        checklist: (updatedNote.checklist || []).map((it) => ({
          id: String(it.id),
          text: String(it.text || ''),
          completed: Boolean(it.completed),
        })),
        createdAt: Number(updatedNote.createdAt || Date.now()),
        updatedAt: Date.now(),
        authorName: String(updatedNote.authorName || userName || 'Admin'),
      };

      setDoc(doc(db, 'managementNotes', noteId), cleanData).catch(console.error);
      return prev.map((n) => (n.id === noteId ? updatedNote : n));
    });
  }, [userName]);

  const value: ProductionContextType = {
    isDataLoading,
    products, addOrUpdateProduct, deleteProduct: (id) => deleteDocument('products', id), deleteAllProducts: () => deleteAllDocsInCollection('products'),
    tasks, addOrUpdateTask: (t) => setDoc(doc(db, 'tasks', t.id), t, { merge: true }), deleteTask: (id) => deleteDocument('tasks', id), deleteAllTasks: () => deleteAllDocsInCollection('tasks'),
    machinery, addOrUpdateMachine: (m) => setDoc(doc(db, 'machinery', m.id), m, { merge: true }), deleteMachine: (id) => deleteDocument('machinery', id),
    taskGroups, addOrUpdateTaskGroup: (tg) => setDoc(doc(db, 'taskGroups', tg.id), tg, { merge: true }), deleteTaskGroup: (id) => deleteDocument('taskGroups', id), deleteAllTaskGroups: () => deleteAllDocsInCollection('taskGroups'),
    prepSteps, addOrUpdatePrepStep, deletePrepStep, deleteAllPrepSteps,
    schedule, setSchedule, updateSchedule, bulkUpdateSchedule, bulkReplaceSchedule, mergeSchedule, clearSchedule,
    calendarNotes, setCalendarNote,
    assignments, updateAssignments,
    palletStorage, addOrUpdatePalletStorage, bulkAddPalletStorage,
    palletClients, addOrUpdatePalletClient, deletePalletClient,
    processTimes, addOrUpdateProcessTime, deleteProcessTime, bulkAddProcessTimes,
    
    userRole, userName, userId, login, logout,
    users, addOrUpdateUser, deleteUser: (id) => id === 'user-1' ? Promise.resolve() : deleteDocument('employees', id), deleteAllUsers: () => deleteAllDocsInCollection('employees', ['user-1']),
    
    availability, setEmployeeAvailability, confirmEmployeeAvailabilitySlot, clearAvailabilityData,
    confirmedHours, setConfirmedHoursForDay, clearConfirmedHoursData,
    
    hrNotes, setEmployeeHrNote,
    notifiedAdminIds, setNotifiedAdminIds,
    notificationDelayHours, setNotificationDelayHours,
    userNotifications, addUserNotification, markNotificationRead,

    shoppingList, setShoppingList: reorderShoppingList, addShoppingListItem, updateShoppingListItem, removeShoppingListItem,
    registeredShoppingItems, addRegisteredShoppingItems, clearRegisteredShoppingItems, removeRegisteredShoppingItem, addOrUpdateRegisteredShoppingItem,

    settings,
    setCalendarColumnWidths,

    assignedTasksDate, setAssignedTasksDate,
    staffingDate, setStaffingDate,
    assignedTasksIsScrolling, setAssignedTasksIsScrolling,
    assignedTasksScrollSpeed, setAssignedTasksScrollSpeed,

    managementNotes,
    addOrUpdateManagementNote,
    deleteManagementNote,
    toggleManagementChecklistItem,
  };

  return (
    <ProductionContext.Provider value={value}>
      {children}
    </ProductionContext.Provider>
  );
};

export const useProduction = (): ProductionContextType => {
  const context = useContext(ProductionContext);
  if (context === undefined) {
    throw new Error('useProduction must be used within a ProductionProvider');
  }
  return context;
};
