import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { BASE_ITEMS, BASE_RECIPES, ItemIndex } from "../lib/catalog";
import { DEFAULT_SETTINGS } from "../lib/defaults";
import { DEFAULT_APP_CONFIG, mergeAppConfig, type AppConfig } from "../lib/appConfig";
import { emptyBook, priceKey, type PriceBook } from "../lib/pricing";
import { isoWeek } from "../lib/season";
import type { Cat, Consumption, Item, PaidPrice, Price, Recipe, Settings, ShoppingDoc, Slot, StockEntry } from "../lib/types";

export interface Household { id: string; name: string; members: Record<string, "admin" | "member">; memberNames?: Record<string, string> }
export interface HistoryEntry { name: string; count: number; itemId?: string | null; category: Cat }
export interface Prefs { favorites: string[]; learnedCategories: Record<string, Cat>; history: Record<string, HistoryEntry> }
export interface UserDoc { households: string[]; current?: string | null }
export interface WeekDoc { slots: Slot[]; persons?: number; warning?: string | null }

export interface StoreState {
  user: User | null;
  authReady: boolean;
  userDoc: UserDoc | null;
  households: Household[];
  hid: string | null;
  household: Household | null;
  isAdmin: boolean;
  settings: Settings;
  prefs: Prefs;
  idx: ItemIndex;
  recipes: Map<string, Recipe>;
  stock: Map<string, StockEntry>;
  consumption: Map<string, Consumption>;
  weekKey: string;
  setWeekKey: (k: string) => void;
  week: WeekDoc | null;
  shopping: ShoppingDoc[];
  book: PriceBook;
  online: boolean;
  loaded: boolean;
  app: AppConfig;
  superAdmin: boolean;
}

const EMPTY_PREFS: Prefs = { favorites: [], learnedCategories: {}, history: {} };
const Ctx = createContext<StoreState | null>(null);
export const useStore = () => useContext(Ctx)!;

const mapOf = <T,>(docs: { id: string; data: () => unknown }[]) => new Map(docs.map((d) => [d.id, d.data() as T]));

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [prefs, setPrefs] = useState<Prefs>(EMPTY_PREFS);
  const [extraItems, setExtraItems] = useState<Item[]>([]);
  const [hhRecipes, setHhRecipes] = useState<Recipe[]>([]);
  const [hiddenBase, setHiddenBase] = useState(new Set<string>());
  const [stock, setStock] = useState(new Map<string, StockEntry>());
  const [consumption, setConsumption] = useState(new Map<string, Consumption>());
  const [weekKey, setWeekKey] = useState(isoWeek());
  const [week, setWeek] = useState<WeekDoc | null>(null);
  const [shopping, setShopping] = useState<ShoppingDoc[]>([]);
  const [shared, setShared] = useState(new Map<string, Price>());
  const [paid, setPaid] = useState(new Map<string, PaidPrice>());
  const [online, setOnline] = useState(navigator.onLine);
  const [loaded, setLoaded] = useState(false);
  const [app, setApp] = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [superAdmin, setSuperAdmin] = useState(false);

  // Réglages dynamiques (lisibles avant connexion) et marque administrateur du compte.
  useEffect(() => onSnapshot(doc(db, "config", "app"), (s) => setApp(mergeAppConfig(s.data() as Partial<AppConfig>)), () => {}), []);
  useEffect(() => {
    if (!user) { setSuperAdmin(false); return; }
    user.getIdTokenResult(true).then((r) => setSuperAdmin(r.claims.superAdmin === true)).catch(() => setSuperAdmin(false));
  }, [user]);

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setAuthReady(true); }), []);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    addEventListener("online", on); addEventListener("offline", off);
    return () => { removeEventListener("online", on); removeEventListener("offline", off); };
  }, []);

  // Profil utilisateur → foyers
  useEffect(() => {
    if (!user) { setUserDoc(null); return; }
    return onSnapshot(doc(db, "users", user.uid), (s) => setUserDoc((s.data() as UserDoc) || { households: [] }));
  }, [user]);

  const hids = userDoc?.households || [];
  useEffect(() => {
    if (!user || !hids.length) { setHouseholds([]); return; }
    const subs = hids.map((id) => onSnapshot(doc(db, "households", id), (s) => {
      setHouseholds((prev) => {
        const rest = prev.filter((h) => h.id !== id);
        const d = s.data() as Omit<Household, "id"> | undefined;
        return d && d.members?.[user.uid] ? [...rest, { id, ...d }] : rest;
      });
    }, () => setHouseholds((prev) => prev.filter((h) => h.id !== id))));
    return () => subs.forEach((u) => u());
  }, [user, hids.join(",")]);

  const hid = userDoc?.current && hids.includes(userDoc.current) ? userDoc.current : hids[0] || null;

  // Données partagées : articles ajoutés par l'IA, prix relevés
  useEffect(() => {
    if (!user) return;
    // Tout le catalogue partagé : articles ajoutés par l'IA et corrections faites dans la console d'administration.
    const a = onSnapshot(collection(db, "items"), (s) => setExtraItems(s.docs.map((d) => ({ ...(d.data() as Item), id: d.id }))));
    const hidden = onSnapshot(query(collection(db, "recipes"), where("householdId", "==", null), where("deleted", "==", true)), (s) => setHiddenBase(new Set(s.docs.map((d) => d.id))), () => {});
    const b = onSnapshot(collection(db, "prices"), (s) => setShared(new Map(s.docs.map((d) => {
      const p = d.data() as Price;
      return [priceKey(p.itemId, p.store, p.organic), p];
    }))));
    return () => { a(); b(); hidden(); };
  }, [user]);

  // Données du foyer courant
  useEffect(() => {
    if (!hid) { setLoaded(!!userDoc); return; }
    setLoaded(false);
    const base = (p: string) => collection(db, "households", hid, p);
    const subs = [
      onSnapshot(doc(db, "households", hid, "meta", "settings"), (s) => {
        const d = s.data() as Partial<Settings> | undefined;
        setSettings({ ...DEFAULT_SETTINGS, ...d, options: { ...DEFAULT_SETTINGS.options, ...(d?.options || {}) } });
        setLoaded(true);
      }),
      onSnapshot(doc(db, "households", hid, "meta", "prefs"), (s) => setPrefs({ ...EMPTY_PREFS, ...(s.data() as Partial<Prefs>) })),
      onSnapshot(base("stock"), (s) => setStock(mapOf<StockEntry>(s.docs))),
      onSnapshot(base("consumption"), (s) => setConsumption(mapOf<Consumption>(s.docs))),
      onSnapshot(base("shopping"), (s) => setShopping(s.docs.map((d) => ({ ...(d.data() as ShoppingDoc), id: d.id })))),
      onSnapshot(base("paidPrices"), (s) => setPaid(mapOf<PaidPrice>(s.docs))),
      onSnapshot(query(collection(db, "recipes"), where("householdId", "==", hid)), (s) => setHhRecipes(s.docs.map((d) => ({ ...(d.data() as Recipe), id: d.id })))),
    ];
    return () => subs.forEach((u) => u());
  }, [hid]);

  useEffect(() => {
    if (!hid) { setWeek(null); return; }
    return onSnapshot(doc(db, "households", hid, "weeks", weekKey), (s) => setWeek((s.data() as WeekDoc) || null));
  }, [hid, weekKey]);

  const idx = useMemo(() => {
    const byId = new Map(BASE_ITEMS.map((x) => [x.id, x]));
    extraItems.forEach((x) => byId.set(x.id, { ...byId.get(x.id), ...x, aliases: x.aliases || [], allergens: x.allergens || [], seasonMonths: x.seasonMonths || [], demoPrice: x.demoPrice || byId.get(x.id)?.demoPrice || 0 }));
    return new ItemIndex([...byId.values()]);
  }, [extraItems]);
  const recipes = useMemo(() => new Map([...BASE_RECIPES.map((r) => (hiddenBase.has(r.id) ? { ...r, deleted: true } : r)), ...hhRecipes].map((r) => [r.id, r])), [hhRecipes, hiddenBase]);
  const book = useMemo(() => ({ ...emptyBook(), shared, paid }), [shared, paid]);
  const household = households.find((h) => h.id === hid) || null;

  const value: StoreState = {
    user, authReady, userDoc, households, hid, household, isAdmin: !!(household && user && household.members[user.uid] === "admin"),
    settings, prefs, idx, recipes, stock, consumption, weekKey, setWeekKey, week, shopping, book, online, loaded, app, superAdmin,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
