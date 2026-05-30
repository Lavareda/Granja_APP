import { Session, User } from "@supabase/supabase-js";
import { createContext, FormEvent, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  BadgeDollarSign,
  BarChart3,
  Bell,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Download,
  Droplets,
  Egg,
  Eye,
  EyeOff,
  Feather,
  FileText,
  Home,
  Layers3,
  LogOut,
  Map,
  Menu,
  NotebookPen,
  Package,
  Pencil,
  Save,
  Settings,
  Sparkles,
  ThermometerSun,
  Tractor,
  Trash2,
  TrendingUp,
  Wheat,
  X,
} from "lucide-react";
import {
  defaultFlockSize,
  demoDailyRecords,
  demoEggSales,
  demoFarmAreas,
  demoFinancialRecords,
  demoFlocks,
  demoInventory,
  today,
} from "./data/demoData";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import type {
  Alert,
  AlertStatus,
  DailyRecord,
  EggSale,
  FarmArea,
  FinancialRecord,
  Flock,
  InventoryItem,
  Page,
  PerformancePoint,
  SeriesPoint,
} from "./types";
import {
  calcularFaseLote,
  calcularIdadeLoteSemanas,
  calcularLucroDiario,
  calcularMortalidade,
  calcularPostura,
  calcularRacaoPorDuzia,
  calcularStatusEstoque,
  gerarAlertas,
  producaoEsperadaPorIdade,
} from "./utils/farm";

type Notification = {
  id: string;
  title: string;
  message: string;
  status: AlertStatus;
  time: string;
  read: boolean;
};

const demoNotifications: Notification[] = [
  { id: "n1", title: "Mortalidade acima da meta", message: "Lote A-2025: 6 aves — acima do limite diário", status: "atencao", time: "há 2h", read: false },
  { id: "n2", title: "Estoque de ração baixo", message: "2.850 kg disponíveis — mínimo: 3.200 kg", status: "critico", time: "há 4h", read: false },
  { id: "n3", title: "Produção abaixo do esperado", message: "Postura: 89,1% — meta: 92,0%", status: "atencao", time: "há 6h", read: false },
  { id: "n4", title: "Temperatura elevada — Galpão 2", message: "29,1 °C registrada — reforçar ventilação", status: "atencao", time: "há 8h", read: true },
];

type DailyRecordForm = {
  data: string;
  lote: string;
  ovosProduzidos: string;
  ovosQuebrados: string;
  mortalidade: string;
  descarte: string;
  racaoKg: string;
  agua: string;
  temperatura: string;
  observacoes: string;
};

type EggSaleForm = {
  dataVenda: string;
  cliente: string;
  quantidadeDuzias: string;
  quantidadeCaixas: string;
  precoPorDuzia: string;
  precoPorCaixa: string;
  formaPagamento: EggSale["formaPagamento"];
  status: EggSale["status"];
};

type AccessRole = "manager" | "granjeiro";

type DashboardData = {
  ovosHoje: number;
  posturaHoje: number;
  mortalidadeHoje: number;
  racaoHoje: number;
  receitaHoje: number;
  lucroHoje: number;
  alertasAtivos: number;
  estoqueCritico: number;
  mortalidadeAcumulada: number;
  ovosPorAveAlojada: number;
  ovosComercializaveis: number;
  pesoMedioOvo: number;
  racaoPorDuzia: number;
  feedSeries: SeriesPoint[];
  eggSeries: SeriesPoint[];
  mortalitySeries: SeriesPoint[];
  performanceSeries: PerformancePoint[];
  alertas: Alert[];
};

type FarmDataContextValue = {
  records: DailyRecord[];
  flocks: Flock[];
  financialRecords: FinancialRecord[];
  sales: EggSale[];
  inventory: InventoryItem[];
  farmAreas: FarmArea[];
  latestRecord?: DailyRecord;
  mainFlock?: Flock;
  latestFinance: FinancialRecord;
  dashboard: DashboardData;
  addDailyRecord: (record: Omit<DailyRecord, "id">) => void;
  updateDailyRecord: (id: number, record: Omit<DailyRecord, "id">) => void;
  deleteDailyRecord: (id: number) => void;
  resetAllData: () => void;
  addEggSale: (sale: Omit<EggSale, "id">) => void;
  addFlock: () => void;
  updateFlock: (id: number, field: keyof Flock, value: string) => void;
  updateFinancialRecord: (field: keyof FinancialRecord, value: number | string) => void;
  updateInventoryItem: (id: number, field: keyof InventoryItem, value: string) => void;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const isDemoMode = true;
const storageKeys = {
  records: "granjaapp.dailyRecords.v2",
  flocks: "granjaapp.flocks.v1",
  finance: "granjaapp.finance.v1",
  sales: "granjaapp.eggSales.v1",
  inventory: "granjaapp.inventory.v1",
  page: "granjaapp.currentPage.v2",
  form: "granjaapp.dailyRecordDraft.v2",
  role: "granjaapp.accessRole.v1",
  onboarding: "granjaapp.onboardingDone.v1",
};

const initialForm: DailyRecordForm = {
  data: today,
  lote: "Lote A-2025",
  ovosProduzidos: "",
  ovosQuebrados: "",
  mortalidade: "",
  descarte: "",
  racaoKg: "",
  agua: "",
  temperatura: "",
  observacoes: "",
};

const initialSaleForm: EggSaleForm = {
  dataVenda: today,
  cliente: "",
  quantidadeDuzias: "",
  quantidadeCaixas: "",
  precoPorDuzia: "10.90",
  precoPorCaixa: "327.00",
  formaPagamento: "pix",
  status: "pago",
};

const numericFields: Array<keyof DailyRecordForm> = [
  "ovosProduzidos",
  "ovosQuebrados",
  "mortalidade",
  "descarte",
  "racaoKg",
  "agua",
  "temperatura",
];

const fieldLabels: Record<keyof DailyRecordForm, string> = {
  data: "Data",
  lote: "Lote",
  ovosProduzidos: "Ovos produzidos",
  ovosQuebrados: "Ovos quebrados",
  mortalidade: "Mortalidade",
  descarte: "Descarte",
  racaoKg: "Consumo de ração (kg)",
  agua: "Consumo de água",
  temperatura: "Temperatura",
  observacoes: "Observações",
};

const navItems: Array<{ page: Page; label: string; icon: typeof Egg; path: string }> = [
  { page: "dashboard", label: "Painel", icon: Home, path: "/painel" },
  { page: "records", label: "Registros", icon: NotebookPen, path: "/registros" },
  { page: "flocks", label: "Lotes", icon: Layers3, path: "/lotes" },
  { page: "finance", label: "Financeiro", icon: BadgeDollarSign, path: "/financeiro" },
  { page: "inventory", label: "Estoque", icon: Package, path: "/estoque" },
  { page: "reports", label: "Relatórios", icon: FileText, path: "/relatorios" },
  { page: "map", label: "Mapa", icon: Map, path: "/mapa" },
  { page: "settings", label: "Configurações", icon: Settings, path: "/configuracoes" },
];

function isAccessRole(value: unknown): value is AccessRole {
  return value === "manager" || value === "granjeiro";
}

function canAccessPage(role: AccessRole, page: Page) {
  if (role === "manager") return true;
  return page === "records";
}

function getVisibleNavItems(role: AccessRole) {
  return navItems.filter((item) => canAccessPage(role, item.page));
}

function pageToPath(page: Page) {
  return navItems.find((item) => item.page === page)?.path ?? "/painel";
}

function pathToPage(pathname: string): Page | null {
  if (pathname === "/" || pathname === "/dashboard") return "dashboard";
  if (pathname === "/registro" || pathname === "/daily-record") return "records";
  if (pathname === "/csv") return "reports";
  return navItems.find((item) => item.path === pathname)?.page ?? null;
}

function parseNumber(value: string) {
  return Number(value.replace(",", "."));
}

function formatNumber(value: number, decimals = 0) {
  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

function formatPercent(value: number) {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function loadFromStorage<T>(key: string, fallback: T, validate?: (value: unknown) => value is T) {
  try {
    const storedValue = window.localStorage.getItem(key);
    if (!storedValue) return fallback;
    const parsedValue = JSON.parse(storedValue);
    return validate && !validate(parsedValue) ? fallback : (parsedValue as T);
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function isPage(value: unknown): value is Page {
  return typeof value === "string" && navItems.some((item) => item.page === value);
}

function isDailyRecordForm(value: unknown): value is DailyRecordForm {
  return Boolean(value && typeof value === "object" && "data" in value && "lote" in value);
}

function isRecordList(value: unknown): value is DailyRecord[] {
  return Array.isArray(value) && value.every((item) => typeof item?.id === "number" && typeof item?.data === "string");
}

function isFlockList(value: unknown): value is Flock[] {
  return Array.isArray(value) && value.every((item) => typeof item?.id === "number" && typeof item?.nome === "string");
}

function isFinancialList(value: unknown): value is FinancialRecord[] {
  return Array.isArray(value) && value.every((item) => typeof item?.id === "number" && typeof item?.receitaDiaria === "number");
}

function isEggSaleList(value: unknown): value is EggSale[] {
  return Array.isArray(value) && value.every((item) => typeof item?.id === "number" && typeof item?.cliente === "string");
}

function isInventoryList(value: unknown): value is InventoryItem[] {
  return Array.isArray(value) && value.every((item) => typeof item?.id === "number" && typeof item?.nome === "string");
}

function escapeCsvValue(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function buildRecordsCsv(records: DailyRecord[]) {
  const headers = ["Data", "Lote", "Ovos", "Quebrados", "Mortalidade", "Descarte", "Ração kg", "Água", "Temperatura", "Observações"];
  const rows = records.map((record) => [
    record.data,
    record.lote,
    record.ovosProduzidos,
    record.ovosQuebrados,
    record.mortalidade,
    record.descarte,
    record.racaoKg,
    record.agua,
    record.temperatura,
    record.observacoes,
  ]);
  return [headers, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\n");
}

function exportCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function statusClasses(status: AlertStatus) {
  if (status === "critico") return "border-red-200 bg-red-50 text-red-800";
  if (status === "atencao") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function statusLabel(status: AlertStatus) {
  if (status === "critico") return "Crítico";
  if (status === "atencao") return "Atenção";
  return "Normal";
}

const AuthContext = createContext<AuthContextValue | null>(null);
const FarmDataContext = createContext<FarmDataContextValue | null>(null);

function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    if (!supabase) throw new Error("Configure o Supabase no arquivo .env para entrar.");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUp(email: string, password: string) {
    if (!supabase) throw new Error("Configure o Supabase no arquivo .env para criar conta.");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  const value = useMemo(() => ({ user: session?.user ?? null, session, loading, signIn, signUp, signOut }), [session, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

function FarmDataProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<DailyRecord[]>(() => loadFromStorage(storageKeys.records, demoDailyRecords, isRecordList));
  const [flocks, setFlocks] = useState<Flock[]>(() => loadFromStorage(storageKeys.flocks, demoFlocks, isFlockList));
  const [financialRecords, setFinancialRecords] = useState<FinancialRecord[]>(() =>
    loadFromStorage(storageKeys.finance, demoFinancialRecords, isFinancialList),
  );
  const [sales, setSales] = useState<EggSale[]>(() => loadFromStorage(storageKeys.sales, demoEggSales, isEggSaleList));
  const [inventory, setInventory] = useState<InventoryItem[]>(() => loadFromStorage(storageKeys.inventory, demoInventory, isInventoryList));
  const farmAreas = demoFarmAreas;

  useEffect(() => saveToStorage(storageKeys.records, records), [records]);
  useEffect(() => saveToStorage(storageKeys.flocks, flocks), [flocks]);
  useEffect(() => saveToStorage(storageKeys.finance, financialRecords), [financialRecords]);
  useEffect(() => saveToStorage(storageKeys.sales, sales), [sales]);
  useEffect(() => saveToStorage(storageKeys.inventory, inventory), [inventory]);

  const sortedRecords = useMemo(() => [...records].sort((a, b) => a.data.localeCompare(b.data)), [records]);
  const latestRecord = sortedRecords[sortedRecords.length - 1];
  const mainFlock = flocks.find((flock) => flock.status !== "encerrado") ?? flocks[0];
  const latestFinance = financialRecords[financialRecords.length - 1] ?? demoFinancialRecords[0];
  const receitaHoje = sales.filter((sale) => sale.dataVenda === today).reduce((sum, sale) => sum + sale.valorTotal, 0);
  const receitaMes = sales
    .filter((sale) => sale.dataVenda.slice(0, 7) === today.slice(0, 7))
    .reduce((sum, sale) => sum + sale.valorTotal, 0);

  const dashboard = useMemo<DashboardData>(() => {
    const recent = sortedRecords.slice(-7);
    const activeBirds = mainFlock?.quantidadeAtual ?? defaultFlockSize;
    const totalEggs = records.reduce((sum, record) => sum + record.ovosProduzidos, 0);
    const ovosComercializaveis = latestRecord ? latestRecord.ovosProduzidos - latestRecord.ovosQuebrados - latestRecord.descarte : 0;
    const alertas = gerarAlertas({ ultimoRegistro: latestRecord, lotePrincipal: mainFlock, estoque: inventory });
    const idade = mainFlock ? calcularIdadeLoteSemanas(mainFlock.dataAlojamento, latestRecord?.data) : 32;

    return {
      ovosHoje: latestRecord?.ovosProduzidos ?? 0,
      posturaHoje: latestRecord ? calcularPostura(latestRecord.ovosProduzidos, activeBirds) : 0,
      mortalidadeHoje: latestRecord?.mortalidade ?? 0,
      racaoHoje: latestRecord?.racaoKg ?? 0,
      receitaHoje: receitaHoje || latestFinance.receitaDiaria,
      lucroHoje: calcularLucroDiario(latestFinance),
      alertasAtivos: alertas.filter((alerta) => alerta.status !== "normal").length,
      estoqueCritico: inventory.filter((item) => item.status === "critico").length,
      mortalidadeAcumulada: mainFlock ? calcularMortalidade(mainFlock) : 0,
      ovosPorAveAlojada: mainFlock?.quantidadeInicial ? totalEggs / mainFlock.quantidadeInicial : 0,
      ovosComercializaveis,
      pesoMedioOvo: 62.4,
      racaoPorDuzia: latestRecord ? calcularRacaoPorDuzia(latestRecord.racaoKg, latestRecord.ovosProduzidos) : 0,
      feedSeries: recent.map((record) => ({ label: dateLabel(record.data), value: record.racaoKg })),
      eggSeries: recent.map((record) => ({ label: dateLabel(record.data), value: record.ovosProduzidos })),
      mortalitySeries: recent.map((record) => ({ label: dateLabel(record.data), value: record.mortalidade })),
      performanceSeries: recent.map((record) => ({
        label: dateLabel(record.data),
        actual: calcularPostura(record.ovosProduzidos, activeBirds),
        expected: producaoEsperadaPorIdade(idade),
      })),
      alertas,
    };
  }, [records, sortedRecords, latestRecord, mainFlock, latestFinance, inventory, receitaHoje]);

  function addDailyRecord(record: Omit<DailyRecord, "id">) {
    setRecords((current) => [...current, { ...record, id: Date.now() }]);
  }

  function updateDailyRecord(id: number, record: Omit<DailyRecord, "id">) {
    setRecords((current) => current.map((r) => (r.id === id ? { ...record, id } : r)));
  }

  function deleteDailyRecord(id: number) {
    setRecords((current) => current.filter((r) => r.id !== id));
  }

  function resetAllData() {
    setRecords(demoDailyRecords);
    setFlocks(demoFlocks);
    setFinancialRecords(demoFinancialRecords);
    setSales(demoEggSales);
    setInventory(demoInventory);
    Object.values(storageKeys).forEach((key) => window.localStorage.removeItem(key));
  }

  function addEggSale(sale: Omit<EggSale, "id">) {
    setSales((current) => [{ ...sale, id: Date.now() }, ...current]);
    setFinancialRecords((current) => {
      const latest = current[current.length - 1] ?? demoFinancialRecords[0];
      return [
        ...current.slice(0, -1),
        {
          ...latest,
          receitaDiaria: receitaHoje + sale.valorTotal,
          receitaMensal: receitaMes + sale.valorTotal,
          precoPorDuzia: sale.precoPorDuzia,
          precoPorCaixa: sale.precoPorCaixa,
        },
      ];
    });
  }

  function addFlock() {
    setFlocks((current) => {
      const nextNumber = current.length + 1;
      return [
        ...current,
        {
          id: Date.now(),
          nome: `Novo lote ${nextNumber}`,
          dataAlojamento: today,
          linhagem: "Hy-Line Brown",
          quantidadeInicial: 1000,
          quantidadeAtual: 1000,
          status: "ativo",
        },
      ];
    });
  }

  function updateFlock(id: number, field: keyof Flock, value: string) {
    setFlocks((current) =>
      current.map((flock) => {
        if (flock.id !== id) return flock;
        const numericFields: Array<keyof Flock> = ["quantidadeInicial", "quantidadeAtual"];
        return {
          ...flock,
          [field]: numericFields.includes(field) ? Math.max(0, Number(value) || 0) : value,
        };
      }),
    );
  }

  function updateFinancialRecord(field: keyof FinancialRecord, value: number | string) {
    setFinancialRecords((current) => {
      const latest = current[current.length - 1] ?? demoFinancialRecords[0];
      const next = { ...latest, [field]: field === "data" ? String(value) : Number(value) || 0 };
      return [...current.slice(0, -1), next];
    });
  }

  function updateInventoryItem(id: number, field: keyof InventoryItem, value: string) {
    setInventory((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const next = {
          ...item,
          [field]: field === "nome" || field === "unidade" || field === "status" ? value : Math.max(0, Number(value) || 0),
        };
        return { ...next, status: calcularStatusEstoque(next) };
      }),
    );
  }

  const value = useMemo(
    () => ({
      records,
      flocks,
      financialRecords,
      sales,
      inventory,
      farmAreas,
      latestRecord,
      mainFlock,
      latestFinance,
      dashboard,
      addDailyRecord,
      updateDailyRecord,
      deleteDailyRecord,
      resetAllData,
      addEggSale,
      addFlock,
      updateFlock,
      updateFinancialRecord,
      updateInventoryItem,
    }),
    [records, flocks, financialRecords, sales, inventory, latestRecord, mainFlock, latestFinance, dashboard],
  );

  return <FarmDataContext.Provider value={value}>{children}</FarmDataContext.Provider>;
}

function useFarmData() {
  const context = useContext(FarmDataContext);
  if (!context) throw new Error("useFarmData must be used inside FarmDataProvider");
  return context;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7f2] px-4">
        <div className="animate-fade-in text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-farm-lime">
            <Tractor className="h-8 w-8 animate-pulse text-farm-green" aria-hidden="true" />
          </div>
          <p className="text-lg font-bold text-farm-ink">GranjaApp</p>
          <p className="mt-1 text-sm text-stone-400">Carregando dados...</p>
        </div>
      </div>
    );
  }

  if (isDemoMode) return <>{children}</>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}

function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isLogin = mode === "login";
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/painel";

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, from, navigate]);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim() || !password.trim()) {
      setError("Informe email e senha.");
      return;
    }

    try {
      setSubmitting(true);
      if (isLogin) {
        await signIn(email, password);
        navigate(from, { replace: true });
      } else {
        await signUp(email, password);
        setMessage("Conta criada. Verifique seu email se a confirmação estiver ativa no Supabase.");
      }
    } catch {
      setError("Não foi possível acessar a conta. Confira os dados e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7f2] px-4 py-8 text-farm-ink">
      <section className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-6 shadow-panel">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-farm-lime text-farm-green">
            <Tractor className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium text-farm-green">GranjaApp · Sítio do Bem</p>
            <h1 className="text-2xl font-semibold">{isLogin ? "Entrar" : "Criar conta"}</h1>
          </div>
        </div>

        {isDemoMode || !isSupabaseConfigured ? (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Modo demonstração ativo. O app pode ser acessado sem login para apresentação.
          </div>
        ) : null}

        {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div> : null}
        {message ? <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">{message}</div> : null}

        <form onSubmit={handleAuthSubmit} className="space-y-4">
          <Field label="Email">
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@sitiodobem.com" className="field-input" />
          </Field>
          <Field label="Senha">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="field-input pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
              </button>
            </div>
          </Field>
          <button
            type="submit"
            disabled={submitting || !isSupabaseConfigured}
            className="flex h-14 w-full items-center justify-center rounded-lg bg-farm-green px-5 text-base font-semibold text-white shadow-lg shadow-green-900/10 transition hover:bg-farm-ink disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            {submitting ? "Enviando..." : isLogin ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-stone-500">
          {isLogin ? "Ainda não tem conta?" : "Já tem conta?"}{" "}
          <Link className="font-semibold text-farm-green" to={isLogin ? "/signup" : "/login"}>
            {isLogin ? "Criar conta" : "Entrar"}
          </Link>
        </p>
      </section>
    </div>
  );
}

function OnboardingModal({ onClose }: { onClose: () => void }) {
  const features = [
    { icon: Home, title: "Painel operacional", desc: "KPIs, alertas automáticos e gráficos em tempo real." },
    { icon: NotebookPen, title: "Registros diários", desc: "Lance produção, ração, água e temperatura por dia." },
    { icon: BadgeDollarSign, title: "Controle financeiro", desc: "Vendas, receitas, custos e margem de lucro." },
    { icon: Package, title: "Estoque", desc: "Ração, medicamentos, bandejas e alertas de reposição." },
    { icon: BarChart3, title: "Indicadores zootécnicos", desc: "Postura, conversão alimentar e mortalidade." },
    { icon: FileText, title: "Relatórios", desc: "Resumos diários, semanais, mensais e exportação CSV." },
    { icon: Map, title: "Mapa da granja", desc: "Layout interativo com dados de cada área produtiva." },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-farm-ink/60 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-2xl animate-fade-in overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-farm-green to-farm-leaf px-8 py-10 text-white">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
            <Tractor className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="text-3xl font-bold">Bem-vindo ao GranjaApp</h2>
          <p className="mt-2 text-lg text-white/80">Plataforma inteligente para gestão avícola</p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Dados simulados para apresentação comercial
          </div>
        </div>
        <div className="px-8 py-6">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400">O que você vai explorar</p>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3 rounded-xl border border-stone-100 p-3 transition hover:border-farm-lime hover:bg-farm-lime/20">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-farm-lime text-farm-green">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold leading-tight">{title}</p>
                  <p className="mt-0.5 text-xs leading-snug text-stone-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={onClose}
            className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-farm-green text-base font-bold text-white shadow-lg shadow-green-900/20 transition hover:bg-farm-ink"
          >
            <Sparkles className="h-5 w-5" aria-hidden="true" />
            Entrar na demonstração
          </button>
          <p className="mt-3 text-center text-xs text-stone-400">GranjaApp · Versão demonstrativa · Dados simulados</p>
        </div>
      </div>
    </div>
  );
}

function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(demoNotifications);
  const unread = notifications.filter((n) => !n.read).length;

  function markAllRead() {
    setNotifications((current) => current.map((n) => ({ ...n, read: true })));
  }

  const dotColor: Record<AlertStatus, string> = {
    critico: "bg-red-500",
    atencao: "bg-amber-400",
    normal: "bg-emerald-500",
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-stone-200 bg-white shadow-sm transition hover:border-farm-green hover:text-farm-green"
        aria-label="Notificações"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button type="button" className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-label="Fechar notificações" />
          <div className="absolute right-0 top-14 z-40 w-80 animate-slide-down overflow-hidden rounded-xl border border-stone-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
              <h3 className="font-bold text-farm-ink">Notificações</h3>
              {unread > 0 && (
                <button type="button" onClick={markAllRead} className="text-xs font-semibold text-farm-green transition hover:text-farm-ink">
                  Marcar todas como lidas
                </button>
              )}
            </div>
            <div className="max-h-80 divide-y divide-stone-50 overflow-y-auto">
              {notifications.map((n) => (
                <div key={n.id} className={`flex items-start gap-3 px-4 py-3 text-sm transition hover:bg-stone-50 ${n.read ? "opacity-55" : ""}`}>
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotColor[n.status]}`} />
                  <div className="min-w-0">
                    <p className="font-semibold leading-snug">{n.title}</p>
                    <p className="mt-0.5 text-xs leading-snug text-stone-500">{n.message}</p>
                    <p className="mt-1 text-xs text-stone-400">{n.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-stone-100 px-4 py-2.5 text-center text-xs text-stone-400">
              Alertas automáticos · dados demonstrativos
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AppFooter() {
  return (
    <footer className="mt-auto border-t border-stone-200 bg-white/60 px-4 py-6 text-center backdrop-blur">
      <p className="text-sm font-semibold text-farm-green">GranjaApp — Plataforma inteligente para gestão avícola</p>
      <p className="mt-1 text-xs text-stone-400">Versão demonstrativa · Dados simulados para apresentação comercial</p>
    </footer>
  );
}

function App() {
  return (
    <AuthProvider>
      <FarmDataProvider>
        <Routes>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          />
        </Routes>
      </FarmDataProvider>
    </AuthProvider>
  );
}

function AppShell() {
  const location = useLocation();
  const initialPage = pathToPage(location.pathname) ?? loadFromStorage(storageKeys.page, "dashboard", isPage);
  const [role, setRole] = useState<AccessRole>(() => loadFromStorage(storageKeys.role, "manager", isAccessRole));
  const [page, setPage] = useState<Page>(() => (canAccessPage(role, initialPage) ? initialPage : "records"));
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const { resetAllData } = useFarmData();
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const visibleNavItems = getVisibleNavItems(role);

  useEffect(() => saveToStorage(storageKeys.page, page), [page]);
  useEffect(() => saveToStorage(storageKeys.role, role), [role]);
  useEffect(() => {
    const routePage = pathToPage(location.pathname);
    if (routePage && !canAccessPage(role, routePage)) {
      setPage("records");
      navigate(pageToPath("records"), { replace: true });
      return;
    }
    if (routePage && routePage !== page) {
      setPage(routePage);
    }
  }, [location.pathname, page, role, navigate]);

  useEffect(() => {
    if (!canAccessPage(role, page)) {
      setPage("records");
      navigate(pageToPath("records"), { replace: true });
    }
  }, [role, page, navigate]);

  async function handleLogout() {
    await signOut();
    setIsSidebarOpen(false);
    navigate("/login");
  }

  function goToPage(nextPage: Page) {
    const allowedPage = canAccessPage(role, nextPage) ? nextPage : "records";
    setPage(allowedPage);
    setIsSidebarOpen(false);
    navigate(pageToPath(allowedPage));
  }

  function changeRole(nextRole: AccessRole) {
    setRole(nextRole);
    if (!canAccessPage(nextRole, page)) {
      setPage("records");
      navigate(pageToPath("records"), { replace: true });
    }
  }

  function handleResetAll() {
    resetAllData();
    setShowResetConfirm(false);
  }

  const pageTitle = navItems.find((item) => item.page === page)?.label ?? "Painel";

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f7f2] text-farm-ink">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-[#f6f7f2]/95 px-4 py-3 backdrop-blur sm:py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white shadow-sm md:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-medium text-farm-green sm:text-sm">
                <Tractor className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden="true" />
                <span className="truncate sm:hidden">GranjaApp</span>
                <span className="hidden truncate sm:inline">GranjaApp · Sítio do Bem</span>
                <span className="hidden shrink-0 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white sm:inline">Modo teste</span>
              </p>
              <h1 className="truncate text-xl font-bold text-farm-ink sm:text-2xl">{pageTitle}</h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <NotificationCenter />
            <div className="hidden items-center gap-2 md:flex">
              <RoleSwitch role={role} onChange={changeRole} />
              <span className="rounded-lg bg-farm-lime px-3 py-2 text-sm font-semibold text-farm-green">{user?.email ?? "Usuário demo"}</span>
              <button onClick={handleLogout} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-600 transition hover:text-farm-green">
                Sair
              </button>
            </div>
          </div>
        </div>
        <nav className={`mx-auto mt-3 hidden max-w-7xl gap-2 md:grid ${role === "manager" ? "grid-cols-8" : "grid-cols-1"}`}>
          {visibleNavItems.map((item) => (
            <TabButton key={item.page} active={page === item.page} icon={item.icon} label={item.label} onClick={() => goToPage(item.page)} />
          ))}
        </nav>
      </header>

      <MobileSidebar
        isOpen={isSidebarOpen}
        activePage={page}
        userEmail={user?.email}
        role={role}
        navItems={visibleNavItems}
        onRoleChange={changeRole}
        onClose={() => setIsSidebarOpen(false)}
        onNavigate={goToPage}
        onLogout={handleLogout}
      />

      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <p className="text-xs text-amber-800">
            ⚠ Ambiente de teste — os dados ficam salvos apenas neste navegador.
          </p>
          {showResetConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-amber-900">Confirmar?</span>
              <button
                onClick={handleResetAll}
                className="rounded-md bg-red-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-red-700"
              >
                Sim, limpar
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="shrink-0 rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
            >
              Limpar dados de teste
            </button>
          )}
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8">
        <div key={page} className="animate-fade-in">
          {page === "dashboard" ? <DashboardPage onNewRecord={() => goToPage("records")} /> : null}
          {page === "records" ? <DailyRecordPage /> : null}
          {page === "flocks" ? <FlocksPage /> : null}
          {page === "finance" ? <FinancePage /> : null}
          {page === "inventory" ? <InventoryPage /> : null}
          {page === "reports" ? <ReportsPage /> : null}
          {page === "map" ? <FarmMapPage /> : null}
          {page === "settings" ? <SettingsPage role={role} onRoleChange={changeRole} /> : null}
        </div>
      </main>
      <AppFooter />
    </div>
  );
}

function DashboardPage({ onNewRecord }: { onNewRecord: () => void }) {
  const { records, latestRecord, dashboard, mainFlock } = useFarmData();
  const activeBirds = mainFlock?.quantidadeAtual ?? defaultFlockSize;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-farm-ink">Resumo operacional</h2>
          <p className="mt-1 text-sm text-stone-400">{records.length} registros · granja com 4.000 poedeiras · dados de demonstração</p>
        </div>
        <button onClick={onNewRecord} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-farm-green px-4 font-semibold text-white shadow-lg shadow-green-900/10 transition hover:bg-farm-ink sm:w-auto">
          <NotebookPen className="h-5 w-5" aria-hidden="true" />
          Novo registro
        </button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Egg} label="Ovos hoje" value={formatNumber(dashboard.ovosHoje)} detail="Coleta total do último dia" />
        <StatCard icon={BarChart3} label="Postura %" value={formatPercent(dashboard.posturaHoje)} detail="Produção sobre aves atuais" />
        <StatCard icon={Feather} label="Mortalidade" value={formatNumber(dashboard.mortalidadeHoje)} detail="Aves no último registro" />
        <StatCard icon={Wheat} label="Ração consumida" value={`${formatNumber(dashboard.racaoHoje)} kg`} detail="Consumo diário registrado" />
        <StatCard icon={BadgeDollarSign} label="Receita hoje" value={formatCurrency(dashboard.receitaHoje)} detail="Venda estimada de ovos" />
        <StatCard icon={TrendingUp} label="Lucro hoje" value={formatCurrency(dashboard.lucroHoje)} detail="Receita menos custos diretos" />
        <StatCard icon={AlertCircle} label="Alertas ativos" value={formatNumber(dashboard.alertasAtivos)} detail="Atenção e críticos" />
        <StatCard icon={Boxes} label="Estoque crítico" value={formatNumber(dashboard.estoqueCritico)} detail="Itens abaixo de 50% do mínimo" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.95fr]">
        <ChartPanel title="Indicadores zootécnicos" subtitle="Desempenho técnico do lote em postura">
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <InfoRow label="% postura" value={formatPercent(dashboard.posturaHoje)} />
            <InfoRow label="Conversão alimentar" value={`${formatNumber(dashboard.racaoPorDuzia, 2)} kg/dz`} />
            <InfoRow label="Mortalidade acumulada" value={formatPercent(dashboard.mortalidadeAcumulada)} />
            <InfoRow label="Ovos por ave alojada" value={formatNumber(dashboard.ovosPorAveAlojada, 1)} />
            <InfoRow label="Ovos comercializáveis" value={formatNumber(dashboard.ovosComercializaveis)} />
            <InfoRow label="Peso médio do ovo" value={`${formatNumber(dashboard.pesoMedioOvo, 1)} g`} />
            <InfoRow label="Ração por dúzia" value={`${formatNumber(dashboard.racaoPorDuzia, 2)} kg`} />
            <InfoRow label="Aves atuais" value={formatNumber(activeBirds)} />
          </div>
          <ComparisonChart data={dashboard.performanceSeries} />
        </ChartPanel>

        <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-farm-ink">Alertas automáticos</h2>
          <p className="mt-0.5 text-xs text-stone-400">Verde: normal · Amarelo: atenção · Vermelho: crítico</p>
          <div className="mt-4 space-y-3">
            {dashboard.alertas.map((alerta) => (
              <AlertCard key={alerta.id} alert={alerta} />
            ))}
          </div>
        </section>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <ChartPanel title="Produção de ovos" subtitle="Últimos lançamentos">
          <LineChart data={dashboard.eggSeries} />
        </ChartPanel>
        <ChartPanel title="Consumo de ração" subtitle="Kg por dia">
          <BarChart data={dashboard.feedSeries} color="bg-farm-straw" unit="kg" />
        </ChartPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <ChartPanel title="Mortalidade" subtitle="Aves por lançamento">
          <BarChart data={dashboard.mortalitySeries} color="bg-farm-clay" unit="aves" />
        </ChartPanel>
        <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-farm-ink">Último lançamento</h2>
          {latestRecord ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoRow label="Data" value={latestRecord.data} />
              <InfoRow label="Lote" value={latestRecord.lote} />
              <InfoRow label="Ovos" value={formatNumber(latestRecord.ovosProduzidos)} />
              <InfoRow label="Postura" value={formatPercent(calcularPostura(latestRecord.ovosProduzidos, activeBirds))} />
              <InfoRow label="Ração" value={`${formatNumber(latestRecord.racaoKg, 1)} kg`} />
              <InfoRow label="Temperatura" value={`${formatNumber(latestRecord.temperatura, 1)} °C`} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-stone-500">Nenhum registro lançado ainda.</p>
          )}
        </section>
      </section>
    </div>
  );
}

function DailyRecordPage() {
  const { records, flocks, mainFlock, addDailyRecord, updateDailyRecord, deleteDailyRecord } = useFarmData();
  const activeBirds = mainFlock?.quantidadeAtual ?? defaultFlockSize;
  const sortedRecords = useMemo(() => [...records].sort((a, b) => b.data.localeCompare(a.data)), [records]);

  const [form, setForm] = useState<DailyRecordForm>(() => ({
    ...initialForm,
    ...loadFromStorage(storageKeys.form, initialForm, isDailyRecordForm),
  }));
  const [errors, setErrors] = useState<Partial<Record<keyof DailyRecordForm, string>>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saved, setSaved] = useState<"create" | "update" | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => { saveToStorage(storageKeys.form, form); }, [form]);

  function updateField(field: keyof DailyRecordForm, value: string) {
    setForm((c) => ({ ...c, [field]: value }));
    setErrors((c) => ({ ...c, [field]: undefined }));
    setSaved(null);
  }

  function validate() {
    const next: Partial<Record<keyof DailyRecordForm, string>> = {};
    if (!form.data) next.data = "Informe a data.";
    if (!form.lote.trim()) next.lote = "Informe o lote.";
    numericFields.forEach((field) => {
      const v = form[field].trim();
      const n = parseNumber(v);
      if (!v) next[field] = `Informe ${fieldLabels[field].toLowerCase()}.`;
      else if (Number.isNaN(n) || n < 0) next[field] = "Use um número ≥ 0.";
    });
    return next;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const data = {
      data: form.data,
      lote: form.lote,
      ovosProduzidos: parseNumber(form.ovosProduzidos),
      ovosQuebrados: parseNumber(form.ovosQuebrados),
      mortalidade: parseNumber(form.mortalidade),
      descarte: parseNumber(form.descarte),
      racaoKg: parseNumber(form.racaoKg),
      agua: parseNumber(form.agua),
      temperatura: parseNumber(form.temperatura),
      observacoes: form.observacoes,
    };

    if (editingId !== null) {
      updateDailyRecord(editingId, data);
      setSaved("update");
      setEditingId(null);
    } else {
      addDailyRecord(data);
      setSaved("create");
    }
    setForm({ ...initialForm, data: form.data, lote: form.lote });
  }

  function startEdit(record: DailyRecord) {
    setEditingId(record.id);
    setForm({
      data: record.data,
      lote: record.lote,
      ovosProduzidos: String(record.ovosProduzidos),
      ovosQuebrados: String(record.ovosQuebrados),
      mortalidade: String(record.mortalidade),
      descarte: String(record.descarte),
      racaoKg: String(record.racaoKg),
      agua: String(record.agua),
      temperatura: String(record.temperatura),
      observacoes: record.observacoes,
    });
    setErrors({});
    setSaved(null);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ ...initialForm });
    setErrors({});
    setSaved(null);
  }

  function executeDelete() {
    if (confirmDeleteId === null) return;
    deleteDailyRecord(confirmDeleteId);
    if (editingId === confirmDeleteId) cancelEdit();
    setConfirmDeleteId(null);
  }

  return (
    <div className="space-y-5">
      {/* Banner de feedback */}
      {saved && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 animate-fade-in">
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="font-semibold">
            {saved === "create" ? "Registro criado — painel atualizado." : "Registro atualizado com sucesso."}
          </p>
        </div>
      )}

      {/* Formulário */}
      <form ref={formRef} onSubmit={handleSubmit} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${editingId !== null ? "bg-amber-100 text-amber-600" : "bg-farm-lime text-farm-green"}`}>
              <NotebookPen className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-bold">{editingId !== null ? "Editar registro" : "Novo registro"}</h2>
              <p className="mt-0.5 text-sm text-stone-400">
                {editingId !== null ? "Altere os campos e salve para atualizar." : "Preencha os dados do dia e salve."}
              </p>
            </div>
          </div>
          {editingId !== null && (
            <button type="button" onClick={cancelEdit} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 px-3 text-sm font-semibold text-stone-500 transition hover:bg-stone-50">
              <X className="h-4 w-4" aria-hidden="true" />
              Cancelar
            </button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data" error={errors.data}>
            <input type="date" value={form.data} onChange={(e) => updateField("data", e.target.value)} className="field-input" />
          </Field>
          <Field label="Lote" error={errors.lote}>
            <select value={form.lote} onChange={(e) => updateField("lote", e.target.value)} className="field-input">
              {flocks.map((f) => <option key={f.id}>{f.nome}</option>)}
            </select>
          </Field>
          <NumberField label="Ovos produzidos" icon={Egg} value={form.ovosProduzidos} error={errors.ovosProduzidos} placeholder="Ex: 3502" onChange={(v) => updateField("ovosProduzidos", v)} />
          <NumberField label="Ovos quebrados" icon={AlertCircle} value={form.ovosQuebrados} error={errors.ovosQuebrados} placeholder="Ex: 46" onChange={(v) => updateField("ovosQuebrados", v)} />
          <NumberField label="Mortalidade" icon={Feather} value={form.mortalidade} error={errors.mortalidade} placeholder="Ex: 6" onChange={(v) => updateField("mortalidade", v)} />
          <NumberField label="Descarte" icon={ClipboardList} value={form.descarte} error={errors.descarte} placeholder="Ex: 8" onChange={(v) => updateField("descarte", v)} />
          <NumberField label="Consumo de ração (kg)" icon={Wheat} value={form.racaoKg} error={errors.racaoKg} placeholder="Ex: 482" onChange={(v) => updateField("racaoKg", v)} />
          <NumberField label="Consumo de água (L)" icon={Droplets} value={form.agua} error={errors.agua} placeholder="Ex: 940" onChange={(v) => updateField("agua", v)} />
          <NumberField label="Temperatura (°C)" icon={ThermometerSun} value={form.temperatura} error={errors.temperatura} placeholder="Ex: 28,7" onChange={(v) => updateField("temperatura", v)} />
          <Field label="Observações" error={errors.observacoes} className="sm:col-span-2">
            <textarea value={form.observacoes} onChange={(e) => updateField("observacoes", e.target.value)} rows={3} className="field-input h-auto min-h-[88px] resize-none py-3" />
          </Field>
        </div>

        <div className="sticky bottom-0 -mx-4 mt-6 border-t border-stone-200 bg-white/95 p-4 backdrop-blur sm:static sm:-mx-6 sm:-mb-6 sm:px-6">
          <button type="submit" className={`flex h-14 w-full items-center justify-center gap-2 rounded-xl px-5 text-base font-bold text-white shadow-lg transition ${editingId !== null ? "bg-amber-500 hover:bg-amber-600" : "bg-farm-green hover:bg-farm-ink"}`}>
            <Save className="h-5 w-5" aria-hidden="true" />
            {editingId !== null ? "Atualizar registro" : "Salvar registro"}
          </button>
        </div>
      </form>

      {/* Lista de registros */}
      <section className="rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <div>
            <h2 className="font-bold text-farm-ink">Registros lançados</h2>
            <p className="mt-0.5 text-xs text-stone-400">{records.length} registro{records.length !== 1 ? "s" : ""} neste navegador</p>
          </div>
        </div>

        {records.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-stone-400">Nenhum registro ainda. Preencha o formulário acima.</p>
        ) : (
          <>
            {/* Cards — mobile */}
            <div className="divide-y divide-stone-100 md:hidden">
              {sortedRecords.map((record) => (
                <article key={record.id} className={`p-4 ${editingId === record.id ? "bg-amber-50" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-farm-ink">{record.lote}</p>
                        {editingId === record.id && (
                          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Editando</span>
                        )}
                      </div>
                      <p className="text-sm text-stone-500">
                        {new Date(`${record.data}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button onClick={() => startEdit(record)} aria-label="Editar" className="flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition active:bg-stone-100 hover:border-farm-green hover:text-farm-green">
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button onClick={() => setConfirmDeleteId(record.id)} aria-label="Excluir" className="flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition active:bg-red-50 hover:border-red-300 hover:text-red-600">
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[
                      ["Ovos", formatNumber(record.ovosProduzidos)],
                      ["Postura", formatPercent(calcularPostura(record.ovosProduzidos, activeBirds))],
                      ["Ração", `${record.racaoKg} kg`],
                    ].map(([lbl, val]) => (
                      <div key={lbl} className="rounded-lg bg-stone-50 p-2 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">{lbl}</p>
                        <p className="mt-0.5 text-sm font-bold text-farm-ink">{val}</p>
                      </div>
                    ))}
                  </div>
                  {record.observacoes ? (
                    <p className="mt-2 truncate text-xs text-stone-400">{record.observacoes}</p>
                  ) : null}
                </article>
              ))}
            </div>

            {/* Tabela — desktop */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase text-stone-500">
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Lote</th>
                    <th className="px-4 py-3">Ovos</th>
                    <th className="px-4 py-3">Postura</th>
                    <th className="px-4 py-3">Ração (kg)</th>
                    <th className="px-4 py-3">Temp. (°C)</th>
                    <th className="px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {sortedRecords.map((record) => (
                    <tr key={record.id} className={`transition ${editingId === record.id ? "bg-amber-50" : "hover:bg-stone-50"}`}>
                      <td className="px-4 py-3 font-medium tabular-nums">{dateLabel(record.data)}</td>
                      <td className="px-4 py-3">{record.lote}</td>
                      <td className="px-4 py-3 tabular-nums">{formatNumber(record.ovosProduzidos)}</td>
                      <td className="px-4 py-3 tabular-nums">{formatPercent(calcularPostura(record.ovosProduzidos, activeBirds))}</td>
                      <td className="px-4 py-3 tabular-nums">{formatNumber(record.racaoKg, 1)}</td>
                      <td className="px-4 py-3 tabular-nums">{formatNumber(record.temperatura, 1)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => startEdit(record)} aria-label="Editar registro" className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 text-stone-500 transition hover:border-farm-green hover:text-farm-green">
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button onClick={() => setConfirmDeleteId(record.id)} aria-label="Excluir registro" className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 text-stone-500 transition hover:border-red-300 hover:text-red-600">
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Modal de confirmação de exclusão */}
      {confirmDeleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-farm-ink/50 px-4 pb-8 backdrop-blur-sm sm:items-center sm:pb-0">
          <div className="w-full max-w-sm animate-fade-in rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-farm-ink">Excluir registro?</h3>
            <p className="mt-2 text-sm text-stone-500">Esta ação não pode ser desfeita.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex h-12 items-center justify-center rounded-xl border border-stone-200 font-semibold text-stone-600 transition hover:bg-stone-50"
              >
                Cancelar
              </button>
              <button
                onClick={executeDelete}
                className="flex h-12 items-center justify-center rounded-xl bg-red-600 font-bold text-white transition hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FlocksPage() {
  const { flocks, addFlock, updateFlock } = useFarmData();

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {flocks.map((flock) => {
          const idade = calcularIdadeLoteSemanas(flock.dataAlojamento);
          return (
            <article key={flock.id} className="rounded-lg border border-stone-200 bg-white p-5 shadow-panel">
              <p className="text-sm font-semibold text-farm-green">{flock.nome}</p>
              <p className="mt-2 text-2xl font-semibold">{formatNumber(flock.quantidadeAtual)} aves</p>
              <div className="mt-4 grid gap-2 text-sm text-stone-600">
                <span>{idade} semanas · {calcularFaseLote(idade)}</span>
                <span>Esperado: {formatPercent(producaoEsperadaPorIdade(idade))}</span>
                <span>Mortalidade: {formatPercent(calcularMortalidade(flock))}</span>
              </div>
            </article>
          );
        })}
      </section>

      <section className="rounded-lg border border-stone-200 bg-white shadow-panel">
        <div className="flex flex-col gap-4 border-b border-stone-200 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Tabela editável de lotes</h2>
            <p className="mt-1 text-sm text-stone-500">Idade, fase, produção esperada e mortalidade são calculadas automaticamente.</p>
          </div>
          <button
            type="button"
            onClick={addFlock}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-farm-green px-4 font-semibold text-white shadow-lg shadow-green-900/10 transition hover:bg-farm-ink sm:w-auto"
          >
            <Layers3 className="h-5 w-5" aria-hidden="true" />
            Novo lote
          </button>
        </div>
        <div className="overflow-x-auto">
          <p className="px-5 pb-1 pt-3 text-xs text-stone-400 md:hidden">← Deslize para ver todas as colunas</p>
          <table className="w-full min-w-[1060px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3">Nome do lote</th>
                <th className="px-4 py-3">Data de alojamento</th>
                <th className="px-4 py-3">Linhagem</th>
                <th className="px-4 py-3">Inicial</th>
                <th className="px-4 py-3">Atual</th>
                <th className="px-4 py-3">Idade</th>
                <th className="px-4 py-3">Fase</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Produção esperada</th>
                <th className="px-4 py-3">Mortalidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {flocks.map((flock) => {
                const idade = calcularIdadeLoteSemanas(flock.dataAlojamento);
                return (
                  <tr key={flock.id}>
                    <td className="px-4 py-3"><input className="table-input" value={flock.nome} onChange={(event) => updateFlock(flock.id, "nome", event.target.value)} /></td>
                    <td className="px-4 py-3"><input className="table-input" type="date" value={flock.dataAlojamento} onChange={(event) => updateFlock(flock.id, "dataAlojamento", event.target.value)} /></td>
                    <td className="px-4 py-3"><input className="table-input" value={flock.linhagem} onChange={(event) => updateFlock(flock.id, "linhagem", event.target.value)} /></td>
                    <td className="px-4 py-3"><input className="table-input" type="number" value={flock.quantidadeInicial} onChange={(event) => updateFlock(flock.id, "quantidadeInicial", event.target.value)} /></td>
                    <td className="px-4 py-3"><input className="table-input" type="number" value={flock.quantidadeAtual} onChange={(event) => updateFlock(flock.id, "quantidadeAtual", event.target.value)} /></td>
                    <td className="px-4 py-3 font-semibold">{idade} sem.</td>
                    <td className="px-4 py-3 capitalize">{calcularFaseLote(idade)}</td>
                    <td className="px-4 py-3">
                      <select className="table-input" value={flock.status} onChange={(event) => updateFlock(flock.id, "status", event.target.value)}>
                        <option value="ativo">Ativo</option>
                        <option value="observacao">Observação</option>
                        <option value="encerrado">Encerrado</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">{formatPercent(producaoEsperadaPorIdade(idade))}</td>
                    <td className="px-4 py-3">{formatPercent(calcularMortalidade(flock))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function FinancePage() {
  const { latestFinance, sales, addEggSale, updateFinancialRecord } = useFarmData();
  const [saleForm, setSaleForm] = useState<EggSaleForm>(initialSaleForm);
  const receitaDia = sales.filter((sale) => sale.dataVenda === today).reduce((sum, sale) => sum + sale.valorTotal, 0);
  const receitaMes = sales.filter((sale) => sale.dataVenda.slice(0, 7) === today.slice(0, 7)).reduce((sum, sale) => sum + sale.valorTotal, 0);
  const contasPendentes = sales.filter((sale) => sale.status === "pendente").reduce((sum, sale) => sum + sale.valorTotal, 0);
  const custoTotalDia = latestFinance.custoRacao + latestFinance.custoMaoDeObra + latestFinance.energia + latestFinance.medicamentos + latestFinance.outrosCustos;
  const lucroEstimado = receitaDia - custoTotalDia;
  const duziasVendidasDia = sales
    .filter((sale) => sale.dataVenda === today)
    .reduce((sum, sale) => sum + sale.quantidadeDuzias + sale.quantidadeCaixas * 30, 0);
  const custoPorDuzia = duziasVendidasDia ? custoTotalDia / duziasVendidasDia : 0;
  const margemLucro = receitaDia ? (lucroEstimado / receitaDia) * 100 : 0;
  const valorTotalVenda =
    parseNumber(saleForm.quantidadeDuzias || "0") * parseNumber(saleForm.precoPorDuzia || "0") +
    parseNumber(saleForm.quantidadeCaixas || "0") * parseNumber(saleForm.precoPorCaixa || "0");

  const financeCards = [
    ["Receita do dia", formatCurrency(receitaDia)],
    ["Receita do mês", formatCurrency(receitaMes)],
    ["Contas pendentes", formatCurrency(contasPendentes)],
    ["Lucro estimado", formatCurrency(lucroEstimado)],
    ["Custo por dúzia", formatCurrency(custoPorDuzia)],
    ["Margem de lucro", formatPercent(margemLucro)],
  ];

  function updateSaleForm(field: keyof EggSaleForm, value: string) {
    setSaleForm((current) => ({ ...current, [field]: value }));
  }

  function handleSaleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const quantidadeDuzias = parseNumber(saleForm.quantidadeDuzias || "0");
    const quantidadeCaixas = parseNumber(saleForm.quantidadeCaixas || "0");
    const precoPorDuzia = parseNumber(saleForm.precoPorDuzia || "0");
    const precoPorCaixa = parseNumber(saleForm.precoPorCaixa || "0");
    const valorTotal = quantidadeDuzias * precoPorDuzia + quantidadeCaixas * precoPorCaixa;

    if (!saleForm.dataVenda || !saleForm.cliente.trim() || valorTotal <= 0) return;

    addEggSale({
      dataVenda: saleForm.dataVenda,
      cliente: saleForm.cliente.trim(),
      quantidadeDuzias,
      quantidadeCaixas,
      precoPorDuzia,
      precoPorCaixa,
      valorTotal,
      formaPagamento: saleForm.formaPagamento,
      status: saleForm.status,
    });
    setSaleForm({ ...initialSaleForm, precoPorDuzia: saleForm.precoPorDuzia, precoPorCaixa: saleForm.precoPorCaixa });
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {financeCards.map(([label, value]) => (
          <StatCard key={label} icon={BadgeDollarSign} label={label} value={value} detail="Calculado a partir das vendas locais" />
        ))}
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-panel">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-farm-lime text-farm-green">
            <Egg className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Registrar venda</h2>
            <p className="mt-1 text-sm text-stone-500">Informe dúzias, caixas, preços e status de pagamento. O valor total é automático.</p>
          </div>
        </div>

        <form onSubmit={handleSaleSubmit} className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Data da venda">
            <input type="date" className="field-input" value={saleForm.dataVenda} onChange={(event) => updateSaleForm("dataVenda", event.target.value)} />
          </Field>
          <Field label="Cliente">
            <input className="field-input" value={saleForm.cliente} onChange={(event) => updateSaleForm("cliente", event.target.value)} placeholder="Ex: Mercado São José" />
          </Field>
          <Field label="Quantidade de dúzias">
            <input type="number" min="0" step="1" className="field-input" value={saleForm.quantidadeDuzias} onChange={(event) => updateSaleForm("quantidadeDuzias", event.target.value)} />
          </Field>
          <Field label="Quantidade de caixas">
            <input type="number" min="0" step="1" className="field-input" value={saleForm.quantidadeCaixas} onChange={(event) => updateSaleForm("quantidadeCaixas", event.target.value)} />
          </Field>
          <Field label="Preço por dúzia">
            <input type="number" min="0" step="0.01" className="field-input" value={saleForm.precoPorDuzia} onChange={(event) => updateSaleForm("precoPorDuzia", event.target.value)} />
          </Field>
          <Field label="Preço por caixa">
            <input type="number" min="0" step="0.01" className="field-input" value={saleForm.precoPorCaixa} onChange={(event) => updateSaleForm("precoPorCaixa", event.target.value)} />
          </Field>
          <Field label="Forma de pagamento">
            <select className="field-input" value={saleForm.formaPagamento} onChange={(event) => updateSaleForm("formaPagamento", event.target.value)}>
              <option value="pix">Pix</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="cartao">Cartão</option>
              <option value="boleto">Boleto</option>
              <option value="transferencia">Transferência</option>
            </select>
          </Field>
          <Field label="Status">
            <select className="field-input" value={saleForm.status} onChange={(event) => updateSaleForm("status", event.target.value)}>
              <option value="pago">Pago</option>
              <option value="pendente">Pendente</option>
            </select>
          </Field>
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 sm:col-span-2 xl:col-span-2">
            <p className="text-sm font-semibold text-stone-500">Valor total automático</p>
            <p className="mt-2 text-2xl font-semibold text-farm-green">{formatCurrency(valorTotalVenda)}</p>
          </div>
          <button type="submit" className="flex h-14 items-center justify-center gap-2 rounded-lg bg-farm-green px-5 font-semibold text-white shadow-lg shadow-green-900/10 transition hover:bg-farm-ink sm:col-span-2 xl:col-span-2">
            <Save className="h-5 w-5" aria-hidden="true" />
            Registrar venda
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white shadow-panel">
        <div className="border-b border-stone-200 p-5">
          <h2 className="text-lg font-semibold">Vendas de ovos</h2>
          <p className="mt-1 text-sm text-stone-500">Histórico salvo em localStorage com status financeiro.</p>
        </div>
        <div className="overflow-x-auto">
          <p className="px-5 pb-1 pt-3 text-xs text-stone-400 md:hidden">← Deslize para ver todas as colunas</p>
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Dúzias</th>
                <th className="px-4 py-3">Caixas</th>
                <th className="px-4 py-3">Preço/dúzia</th>
                <th className="px-4 py-3">Preço/caixa</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Pagamento</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {sales.map((sale) => (
                <tr key={sale.id}>
                  <td className="px-4 py-3 font-medium">{sale.dataVenda}</td>
                  <td className="px-4 py-3">{sale.cliente}</td>
                  <td className="px-4 py-3">{formatNumber(sale.quantidadeDuzias)}</td>
                  <td className="px-4 py-3">{formatNumber(sale.quantidadeCaixas)}</td>
                  <td className="px-4 py-3">{formatCurrency(sale.precoPorDuzia)}</td>
                  <td className="px-4 py-3">{formatCurrency(sale.precoPorCaixa)}</td>
                  <td className="px-4 py-3 font-semibold">{formatCurrency(sale.valorTotal)}</td>
                  <td className="px-4 py-3 capitalize">{sale.formaPagamento}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${sale.status === "pago" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {sale.status === "pago" ? "Pago" : "Pendente"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-panel">
        <h2 className="text-lg font-semibold">Premissas financeiras</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(["receitaDiaria", "receitaMensal", "precoPorDuzia", "precoPorCaixa", "custoRacao", "custoMaoDeObra", "energia", "medicamentos", "outrosCustos"] as Array<keyof FinancialRecord>).map((field) => (
            <Field key={field} label={financialFieldLabel(field)}>
              <input
                type="number"
                min="0"
                step="0.01"
                className="field-input"
                value={latestFinance[field]}
                onChange={(event) => updateFinancialRecord(field, event.target.value)}
              />
            </Field>
          ))}
        </div>
      </section>
    </div>
  );
}

function InventoryPage() {
  const { inventory, updateInventoryItem } = useFarmData();
  const lowStock = inventory.filter((item) => item.status !== "normal");

  return (
    <div className="space-y-5">
      {lowStock.length ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <h2 className="text-lg font-semibold">Alertas de estoque</h2>
          <p className="mt-1 text-sm">{lowStock.map((item) => item.nome).join(", ")} abaixo do nível mínimo planejado.</p>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {inventory.map((item) => (
          <article key={item.id} className={`rounded-lg border p-5 shadow-panel ${statusClasses(item.status)}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{item.nome}</p>
                <p className="mt-2 text-3xl font-semibold">{formatNumber(item.quantidadeAtual)} {item.unidade}</p>
              </div>
              <Package className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm font-medium">Mínimo: {formatNumber(item.estoqueMinimo)} {item.unidade} · {statusLabel(item.status)}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest opacity-60">Atual</span>
                <input className="table-input bg-white/70" type="number" value={item.quantidadeAtual} onChange={(event) => updateInventoryItem(item.id, "quantidadeAtual", event.target.value)} aria-label={`Quantidade de ${item.nome}`} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest opacity-60">Mínimo</span>
                <input className="table-input bg-white/70" type="number" value={item.estoqueMinimo} onChange={(event) => updateInventoryItem(item.id, "estoqueMinimo", event.target.value)} aria-label={`Mínimo de ${item.nome}`} />
              </label>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function ReportsPage() {
  const { records, latestFinance, dashboard } = useFarmData();
  const sortedRecords = useMemo(() => [...records].sort((a, b) => b.data.localeCompare(a.data)), [records]);
  const weeklyEggs = records.slice(-7).reduce((sum, record) => sum + record.ovosProduzidos, 0);
  const monthlyEggs = records.reduce((sum, record) => sum + record.ovosProduzidos, 0);
  const cards = [
    ["Receita", formatCurrency(latestFinance.receitaDiaria), "Resumo diário"],
    ["Custo", formatCurrency(latestFinance.receitaDiaria - dashboard.lucroHoje), "Resumo diário"],
    ["Lucro", formatCurrency(dashboard.lucroHoje), "Resumo diário"],
    ["Ovos", formatNumber(dashboard.ovosHoje), "Resumo diário"],
    ["Mortalidade", formatNumber(dashboard.mortalidadeHoje), "Resumo diário"],
    ["Ração", `${formatNumber(dashboard.racaoHoje)} kg`, "Resumo diário"],
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-panel">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Relatórios</h2>
            <p className="mt-1 text-sm text-stone-500">Resumo diário, semanal e mensal com exportação CSV local.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button onClick={() => exportCsv(`granjaapp-relatorio-${today}.csv`, buildRecordsCsv(sortedRecords))} className="flex h-12 items-center justify-center gap-2 rounded-lg bg-farm-green px-4 font-semibold text-white shadow-lg shadow-green-900/10 transition hover:bg-farm-ink">
              <Download className="h-5 w-5" aria-hidden="true" />
              Exportar CSV
            </button>
            <button disabled className="flex h-12 items-center justify-center gap-2 rounded-lg border border-stone-200 bg-stone-100 px-4 font-semibold text-stone-500">
              <FileText className="h-5 w-5" aria-hidden="true" />
              PDF em breve
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value, detail]) => (
          <StatCard key={label} icon={FileText} label={label} value={value} detail={detail} />
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <ReportSummary title="Resumo diário" ovos={dashboard.ovosHoje} racao={dashboard.racaoHoje} lucro={dashboard.lucroHoje} />
        <ReportSummary title="Resumo semanal" ovos={weeklyEggs} racao={records.slice(-7).reduce((sum, record) => sum + record.racaoKg, 0)} lucro={dashboard.lucroHoje * 7} />
        <ReportSummary title="Resumo mensal" ovos={monthlyEggs} racao={records.reduce((sum, record) => sum + record.racaoKg, 0)} lucro={dashboard.lucroHoje * 30} />
      </section>
    </div>
  );
}

function FarmMapPage() {
  const { farmAreas } = useFarmData();
  const [selectedArea, setSelectedArea] = useState<FarmArea>(farmAreas[0]);

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-panel">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-farm-green">
            <Map className="h-4 w-4" aria-hidden="true" />
            Mapa da granja
          </p>
          <h2 className="mt-1 text-xl font-semibold">Layout operacional</h2>
          <p className="mt-1 text-sm text-stone-500">Áreas clicáveis com produção, aves, temperatura, estoque relacionado e alertas.</p>
        </div>
        <span className="rounded-lg bg-farm-lime px-3 py-2 text-sm font-semibold text-farm-green">4.000 poedeiras</span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
        <div className="relative min-h-[320px] overflow-hidden rounded-lg border border-stone-200 bg-[#dfead2] p-4 sm:min-h-[460px]">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px)] bg-[size:36px_36px]" />
          <div className="absolute left-[48%] top-0 h-full w-[7%] bg-stone-300/70" />
          <div className="absolute bottom-[40%] left-0 h-[8%] w-full bg-stone-300/70" />
          {farmAreas.map((area) => (
            <button
              key={area.id}
              type="button"
              onClick={() => setSelectedArea(area)}
              className={`absolute z-10 rounded-lg border-2 p-3 text-left text-xs font-semibold shadow-lg transition hover:scale-[1.02] sm:text-sm ${area.className} ${
                selectedArea.id === area.id ? "border-white ring-4 ring-farm-lime" : "border-white/70"
              }`}
            >
              {area.nome}
            </button>
          ))}
        </div>

        <aside className="rounded-lg border border-stone-200 bg-stone-50 p-5">
          <h3 className="text-lg font-semibold">{selectedArea.nome}</h3>
          <div className="mt-4 grid gap-3">
            <InfoRow label="Produção" value={selectedArea.producao} />
            <InfoRow label="Aves" value={selectedArea.aves} />
            <InfoRow label="Temperatura" value={selectedArea.temperatura} />
            <InfoRow label="Estoque relacionado" value={selectedArea.estoqueRelacionado} />
          </div>
          <div className="mt-4 space-y-3">
            {selectedArea.alertas.length ? selectedArea.alertas.map((alerta) => <AlertCard key={alerta.id} alert={alerta} />) : <AlertCard alert={{ id: "ok", titulo: "Sem alertas", detalhe: "Área em operação normal", status: "normal" }} />}
          </div>
        </aside>
      </div>
    </section>
  );
}

function SettingsPage({ role, onRoleChange }: { role: AccessRole; onRoleChange: (role: AccessRole) => void }) {
  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-panel">
        <h2 className="text-lg font-semibold">Perfil de acesso</h2>
        <p className="mt-1 text-sm text-stone-500">Controle demonstrativo salvo em localStorage. O granjeiro acessa apenas o registro diário; o empresário acessa gestão completa e financeiro.</p>
        <div className="mt-4 max-w-md">
          <RoleSwitch role={role} onChange={onRoleChange} />
        </div>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-panel">
        <h2 className="text-lg font-semibold">Configurações</h2>
        <p className="mt-1 text-sm text-stone-500">Modo demonstração ativo com persistência em localStorage. Supabase permanece preparado, mas sem novos módulos conectados.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <InfoRow label="Fazenda" value="Sítio do Bem" />
          <InfoRow label="Capacidade" value="4.000 poedeiras" />
          <InfoRow label="Persistência" value="localStorage" />
          <InfoRow label="Idioma" value="Português do Brasil" />
        </div>
      </section>
    </div>
  );
}

function MobileSidebar({
  isOpen,
  activePage,
  userEmail,
  role,
  navItems,
  onRoleChange,
  onClose,
  onNavigate,
  onLogout,
}: {
  isOpen: boolean;
  activePage: Page;
  userEmail?: string;
  role: AccessRole;
  navItems: Array<{ page: Page; label: string; icon: typeof Egg; path: string }>;
  onRoleChange: (role: AccessRole) => void;
  onClose: () => void;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}) {
  return (
    <div className={`fixed inset-0 z-40 md:hidden ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
      <button type="button" onClick={onClose} className={`absolute inset-0 bg-farm-ink/45 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`} aria-label="Fechar menu" />
      <aside className={`absolute left-0 top-0 flex h-full w-80 max-w-[86vw] flex-col bg-farm-ink text-white shadow-2xl transition-transform duration-300 ease-out ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-farm-lime text-farm-ink">
              <Tractor className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-lg font-semibold">GranjaApp</p>
              <p className="text-xs text-white/60">Sítio do Bem</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10" aria-label="Fechar menu">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-5">
          {navItems.map((item) => (
            <MobileNavButton key={item.page} active={activePage === item.page} icon={item.icon} label={item.label} onClick={() => onNavigate(item.page)} />
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="mb-3">
            <RoleSwitch role={role} onChange={onRoleChange} compact />
          </div>
          <div className="mb-3 rounded-lg bg-white/8 p-3">
            <p className="text-xs text-white/55">Usuário</p>
            <p className="truncate text-sm font-semibold">{userEmail ?? "Conta demo"}</p>
          </div>
          <button type="button" onClick={onLogout} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/10 text-sm font-semibold text-white/80 transition hover:bg-white/10">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sair
          </button>
        </div>
      </aside>
    </div>
  );
}

function MobileNavButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Egg; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex h-14 w-full items-center gap-3 rounded-xl px-4 text-base font-semibold transition ${active ? "bg-white text-farm-ink shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      {label}
    </button>
  );
}

function RoleSwitch({
  role,
  onChange,
  compact = false,
}: {
  role: AccessRole;
  onChange: (role: AccessRole) => void;
  compact?: boolean;
}) {
  const baseClass = compact
    ? "grid grid-cols-2 gap-1 rounded-lg bg-white/10 p-1"
    : "grid grid-cols-2 gap-1 rounded-lg border border-stone-200 bg-white p-1";
  const inactiveClass = compact
    ? "text-white/70 hover:bg-white/10 hover:text-white"
    : "text-stone-600 hover:bg-stone-50 hover:text-farm-green";
  const activeClass = compact ? "bg-white text-farm-ink" : "bg-farm-green text-white";

  return (
    <div className={baseClass} aria-label="Perfil de acesso">
      <button
        type="button"
        onClick={() => onChange("granjeiro")}
        className={`h-11 rounded-md px-3 text-sm font-semibold transition ${role === "granjeiro" ? activeClass : inactiveClass}`}
      >
        Granjeiro
      </button>
      <button
        type="button"
        onClick={() => onChange("manager")}
        className={`h-11 rounded-md px-3 text-sm font-semibold transition ${role === "manager" ? activeClass : inactiveClass}`}
      >
        Empresário
      </button>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, detail }: { icon: typeof Egg; label: string; value: string; detail: string }) {
  return (
    <article className="group rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-farm-green/30 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</p>
          <p className="mt-2 break-words text-2xl font-bold text-farm-ink">{value}</p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-farm-lime text-farm-green transition-colors duration-200 group-hover:bg-farm-green group-hover:text-white">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 text-xs text-stone-400">{detail}</p>
    </article>
  );
}

function ChartPanel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <h2 className="text-lg font-bold text-farm-ink">{title}</h2>
      <p className="mt-0.5 text-xs text-stone-400">{subtitle}</p>
      {children}
    </section>
  );
}

function LineChart({ data }: { data: SeriesPoint[] }) {
  const width = 640;
  const height = 230;
  const padding = 28;
  const values = data.map((point) => point.value);
  const min = Math.min(...values) - 80;
  const max = Math.max(...values) + 80;
  const points = data.map((point, index) => {
    const x = data.length === 1 ? width / 2 : padding + (index * (width - padding * 2)) / (data.length - 1);
    const ratio = max === min ? 0.5 : (point.value - min) / (max - min);
    const y = height - padding - ratio * (height - padding * 2);
    return { ...point, x, y };
  });
  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
    : "";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-5 h-64 w-full" role="img" aria-label="Gráfico de produção de ovos">
      <defs>
        <linearGradient id="eggGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2f6f4f" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#2f6f4f" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((line) => (
        <line key={line} x1={padding} x2={width - padding} y1={padding + line * 48} y2={padding + line * 48} stroke="#e7e5df" strokeWidth="1" />
      ))}
      <path d={areaPath} fill="url(#eggGradient)" />
      <path d={linePath} fill="none" stroke="#2f6f4f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
      {points.map((point) => (
        <g key={`${point.label}-${point.value}`}>
          <circle cx={point.x} cy={point.y} r="5" fill="#ffffff" stroke="#2f6f4f" strokeWidth="3" />
          <text x={point.x} y={height - 6} textAnchor="middle" className="fill-stone-500 text-xs">{point.label}</text>
        </g>
      ))}
    </svg>
  );
}

function ComparisonChart({ data }: { data: PerformancePoint[] }) {
  const width = 640;
  const height = 230;
  const padding = 30;
  const points = data.map((point, index) => {
    const x = data.length === 1 ? width / 2 : padding + (index * (width - padding * 2)) / (data.length - 1);
    return { ...point, x, actualY: height - padding - (point.actual / 100) * (height - padding * 2), expectedY: height - padding - (point.expected / 100) * (height - padding * 2) };
  });
  const actualPath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.actualY}`).join(" ");
  const expectedPath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.expectedY}`).join(" ");

  return (
    <div className="mt-5">
      <div className="mb-3 flex flex-wrap gap-4 text-sm font-medium text-stone-600">
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-farm-green" />Real</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-farm-clay" />Esperada</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full" role="img" aria-label="Curva real vs curva esperada">
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = height - padding - (tick / 100) * (height - padding * 2);
          return (
            <g key={tick}>
              <line x1={padding} x2={width - padding} y1={y} y2={y} stroke="#e7e5df" strokeWidth="1" />
              <text x={8} y={y + 4} className="fill-stone-500 text-xs">{tick}%</text>
            </g>
          );
        })}
        <path d={expectedPath} fill="none" stroke="#b86b4b" strokeDasharray="8 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        <path d={actualPath} fill="none" stroke="#2f6f4f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
        {points.map((point) => (
          <g key={`${point.label}-${point.actual}`}>
            <circle cx={point.x} cy={point.actualY} r="5" fill="#ffffff" stroke="#2f6f4f" strokeWidth="3" />
            <text x={point.x} y={height - 6} textAnchor="middle" className="fill-stone-500 text-xs">{point.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function BarChart({ data, color, unit }: { data: SeriesPoint[]; color: string; unit: string }) {
  const max = Math.max(...data.map((point) => point.value), 1);
  return (
    <div className="mt-5 flex h-64 items-end gap-3">
      {data.map((point) => (
        <div key={`${point.label}-${point.value}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
          <div className="flex h-full w-full items-end justify-center rounded bg-stone-100">
            <div className={`w-full max-w-12 rounded-t ${color}`} style={{ height: `${(point.value / max) * 100}%` }} title={`${point.value} ${unit}`} />
          </div>
          <span className="text-xs font-medium text-stone-500">{point.label}</span>
        </div>
      ))}
    </div>
  );
}

function AlertCard({ alert }: { alert: Alert }) {
  return (
    <article className={`flex gap-3 rounded-lg border p-4 ${statusClasses(alert.status)}`}>
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        <h3 className="font-semibold">{alert.titulo}</h3>
        <p className="mt-1 text-sm opacity-85">{alert.detalhe}</p>
      </div>
    </article>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-stone-100 bg-stone-50 p-3 transition hover:border-stone-200 hover:bg-white">
      <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-farm-ink">{value}</p>
    </div>
  );
}

function ReportSummary({ title, ovos, racao, lucro }: { title: string; ovos: number; racao: number; lucro: number }) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-panel">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4 grid gap-3">
        <InfoRow label="Ovos" value={formatNumber(ovos)} />
        <InfoRow label="Ração" value={`${formatNumber(racao)} kg`} />
        <InfoRow label="Lucro" value={formatCurrency(lucro)} />
      </div>
    </section>
  );
}

function TabButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Egg; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex h-11 items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold transition-all duration-150 ${
        active
          ? "bg-farm-green text-white shadow-sm"
          : "border border-stone-200 bg-white text-stone-500 hover:border-farm-green/50 hover:bg-farm-lime/40 hover:text-farm-green"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function Field({ label, error, className = "", children }: { label: string; error?: string; className?: string; children: ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-semibold text-farm-ink">{label}</span>
      {children}
      {error ? <span className="mt-2 block text-sm font-medium text-red-600">{error}</span> : null}
    </label>
  );
}

function NumberField({ label, icon: Icon, value, error, placeholder, onChange }: { label: string; icon: typeof Egg; value: string; error?: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <Field label={label} error={error}>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
        <input type="number" min="0" step="0.1" inputMode="decimal" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="field-input pl-12" />
      </div>
    </Field>
  );
}

function financialFieldLabel(field: keyof FinancialRecord) {
  const labels: Partial<Record<keyof FinancialRecord, string>> = {
    receitaDiaria: "Receita diária",
    receitaMensal: "Receita mensal",
    precoPorDuzia: "Preço por dúzia",
    precoPorCaixa: "Preço por caixa",
    custoRacao: "Custo de ração",
    custoMaoDeObra: "Custo de mão de obra",
    energia: "Energia",
    medicamentos: "Medicamentos",
    outrosCustos: "Outros custos",
  };
  return labels[field] ?? String(field);
}

export default App;
