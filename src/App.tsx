import { Session, User } from "@supabase/supabase-js";
import { createContext, FormEvent, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  BadgeDollarSign,
  BarChart3,
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
  Save,
  Settings,
  ThermometerSun,
  Tractor,
  TrendingUp,
  Wheat,
  X,
} from "lucide-react";
import {
  defaultFlockSize,
  demoDailyRecords,
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
  inventory: InventoryItem[];
  farmAreas: FarmArea[];
  latestRecord?: DailyRecord;
  mainFlock?: Flock;
  latestFinance: FinancialRecord;
  dashboard: DashboardData;
  addDailyRecord: (record: Omit<DailyRecord, "id">) => void;
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
  inventory: "granjaapp.inventory.v1",
  page: "granjaapp.currentPage.v2",
  form: "granjaapp.dailyRecordDraft.v2",
  role: "granjaapp.accessRole.v1",
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
  const [inventory, setInventory] = useState<InventoryItem[]>(() => loadFromStorage(storageKeys.inventory, demoInventory, isInventoryList));
  const farmAreas = demoFarmAreas;

  useEffect(() => saveToStorage(storageKeys.records, records), [records]);
  useEffect(() => saveToStorage(storageKeys.flocks, flocks), [flocks]);
  useEffect(() => saveToStorage(storageKeys.finance, financialRecords), [financialRecords]);
  useEffect(() => saveToStorage(storageKeys.inventory, inventory), [inventory]);

  const sortedRecords = useMemo(() => [...records].sort((a, b) => a.data.localeCompare(b.data)), [records]);
  const latestRecord = sortedRecords[sortedRecords.length - 1];
  const mainFlock = flocks.find((flock) => flock.status !== "encerrado") ?? flocks[0];
  const latestFinance = financialRecords[financialRecords.length - 1] ?? demoFinancialRecords[0];

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
      receitaHoje: latestFinance.receitaDiaria,
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
  }, [records, sortedRecords, latestRecord, mainFlock, latestFinance, inventory]);

  function addDailyRecord(record: Omit<DailyRecord, "id">) {
    setRecords((current) => [...current, { ...record, id: Date.now() }]);
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
      inventory,
      farmAreas,
      latestRecord,
      mainFlock,
      latestFinance,
      dashboard,
      addDailyRecord,
      addFlock,
      updateFlock,
      updateFinancialRecord,
      updateInventoryItem,
    }),
    [records, flocks, financialRecords, inventory, latestRecord, mainFlock, latestFinance, dashboard],
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
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7f2] px-4 text-farm-ink">
        <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-panel">
          <p className="font-semibold">Carregando sessão...</p>
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
  const [form, setForm] = useState<DailyRecordForm>(() => ({ ...initialForm, ...loadFromStorage(storageKeys.form, initialForm, isDailyRecordForm) }));
  const [errors, setErrors] = useState<Partial<Record<keyof DailyRecordForm, string>>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { addDailyRecord } = useFarmData();
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const visibleNavItems = getVisibleNavItems(role);

  useEffect(() => saveToStorage(storageKeys.page, page), [page]);
  useEffect(() => saveToStorage(storageKeys.form, form), [form]);
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

  function updateField(field: keyof DailyRecordForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setShowSuccess(false);
  }

  function validate() {
    const nextErrors: Partial<Record<keyof DailyRecordForm, string>> = {};
    if (!form.data) nextErrors.data = "Informe a data.";
    if (!form.lote.trim()) nextErrors.lote = "Informe o lote.";

    numericFields.forEach((field) => {
      const value = form[field].trim();
      const numberValue = parseNumber(value);
      if (!value) nextErrors[field] = `Informe ${fieldLabels[field].toLowerCase()}.`;
      else if (Number.isNaN(numberValue) || numberValue < 0) nextErrors[field] = "Use um número maior ou igual a zero.";
    });

    return nextErrors;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    addDailyRecord({
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
    });
    setForm({ ...initialForm, data: form.data, lote: form.lote });
    setShowSuccess(true);
  }

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

  const pageTitle = navItems.find((item) => item.page === page)?.label ?? "Painel";

  return (
    <div className="min-h-screen bg-[#f6f7f2] text-farm-ink">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-[#f6f7f2]/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white shadow-sm md:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-farm-green">
                <Tractor className="h-4 w-4" aria-hidden="true" />
                GranjaApp · Sítio do Bem
                <span className="rounded bg-farm-lime px-2 py-0.5 text-xs font-semibold text-farm-green">Modo demonstração</span>
              </p>
              <h1 className="truncate text-2xl font-semibold text-farm-ink">{pageTitle}</h1>
            </div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <RoleSwitch role={role} onChange={changeRole} />
            <span className="rounded-lg bg-farm-lime px-3 py-2 text-sm font-semibold text-farm-green">{user?.email ?? "Usuário demo"}</span>
            <button onClick={handleLogout} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-600 transition hover:text-farm-green">
              Sair
            </button>
          </div>
        </div>
        <nav className={`mx-auto mt-4 hidden max-w-7xl gap-2 md:grid ${role === "manager" ? "grid-cols-8" : "grid-cols-1"}`}>
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

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        {showSuccess ? (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Registro salvo e painel atualizado.</p>
              <p className="mt-1 text-sm">Os KPIs já refletem o último lançamento local.</p>
            </div>
          </div>
        ) : null}

        {page === "dashboard" ? <DashboardPage onNewRecord={() => goToPage("records")} /> : null}
        {page === "records" ? <DailyRecordPage form={form} errors={errors} onChange={updateField} onSubmit={handleSubmit} /> : null}
        {page === "flocks" ? <FlocksPage /> : null}
        {page === "finance" ? <FinancePage /> : null}
        {page === "inventory" ? <InventoryPage /> : null}
        {page === "reports" ? <ReportsPage /> : null}
        {page === "map" ? <FarmMapPage /> : null}
        {page === "settings" ? <SettingsPage role={role} onRoleChange={changeRole} /> : null}
      </main>
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
          <h2 className="text-xl font-semibold">Resumo operacional</h2>
          <p className="mt-1 text-sm text-stone-500">{records.length} registros locais de uma granja com 4.000 poedeiras em demonstração.</p>
        </div>
        <button onClick={onNewRecord} className="flex h-12 items-center justify-center gap-2 rounded-lg bg-farm-green px-4 font-semibold text-white shadow-lg shadow-green-900/10 transition hover:bg-farm-ink">
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

        <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-panel">
          <h2 className="text-lg font-semibold">Alertas automáticos</h2>
          <p className="mt-1 text-sm text-stone-500">Cores: verde normal, amarelo atenção e vermelho crítico.</p>
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
        <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-panel">
          <h2 className="text-lg font-semibold">Último lançamento</h2>
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

function DailyRecordPage({
  form,
  errors,
  onChange,
  onSubmit,
}: {
  form: DailyRecordForm;
  errors: Partial<Record<keyof DailyRecordForm, string>>;
  onChange: (field: keyof DailyRecordForm, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { flocks } = useFarmData();

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-stone-200 bg-white p-4 shadow-panel sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-farm-lime text-farm-green">
          <NotebookPen className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Dados do dia</h2>
          <p className="mt-1 text-sm text-stone-500">Preencha e salve para atualizar o painel em localStorage.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data" error={errors.data}>
          <input type="date" value={form.data} onChange={(event) => onChange("data", event.target.value)} className="field-input" />
        </Field>
        <Field label="Lote" error={errors.lote}>
          <select value={form.lote} onChange={(event) => onChange("lote", event.target.value)} className="field-input">
            {flocks.map((flock) => (
              <option key={flock.id}>{flock.nome}</option>
            ))}
          </select>
        </Field>
        <NumberField label="Ovos produzidos" icon={Egg} value={form.ovosProduzidos} error={errors.ovosProduzidos} placeholder="Ex: 3502" onChange={(value) => onChange("ovosProduzidos", value)} />
        <NumberField label="Ovos quebrados" icon={AlertCircle} value={form.ovosQuebrados} error={errors.ovosQuebrados} placeholder="Ex: 46" onChange={(value) => onChange("ovosQuebrados", value)} />
        <NumberField label="Mortalidade" icon={Feather} value={form.mortalidade} error={errors.mortalidade} placeholder="Ex: 6" onChange={(value) => onChange("mortalidade", value)} />
        <NumberField label="Descarte" icon={ClipboardList} value={form.descarte} error={errors.descarte} placeholder="Ex: 8" onChange={(value) => onChange("descarte", value)} />
        <NumberField label="Consumo de ração (kg)" icon={Wheat} value={form.racaoKg} error={errors.racaoKg} placeholder="Ex: 482" onChange={(value) => onChange("racaoKg", value)} />
        <NumberField label="Consumo de água" icon={Droplets} value={form.agua} error={errors.agua} placeholder="Ex: 940" onChange={(value) => onChange("agua", value)} />
        <NumberField label="Temperatura" icon={ThermometerSun} value={form.temperatura} error={errors.temperatura} placeholder="Ex: 28,7" onChange={(value) => onChange("temperatura", value)} />
        <Field label="Observações" error={errors.observacoes} className="sm:col-span-2">
          <textarea value={form.observacoes} onChange={(event) => onChange("observacoes", event.target.value)} rows={4} className="field-input resize-none" />
        </Field>
      </div>

      <div className="sticky bottom-0 -mx-4 mt-6 border-t border-stone-200 bg-white/95 p-4 backdrop-blur sm:static sm:-mx-6 sm:-mb-6 sm:px-6">
        <button type="submit" className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-farm-green px-5 text-base font-semibold text-white shadow-lg shadow-green-900/10 transition hover:bg-farm-ink">
          <Save className="h-5 w-5" aria-hidden="true" />
          Salvar registro
        </button>
      </div>
    </form>
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

      <section className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-panel">
        <div className="flex flex-col gap-4 border-b border-stone-200 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Tabela editável de lotes</h2>
            <p className="mt-1 text-sm text-stone-500">Idade, fase, produção esperada e mortalidade são calculadas automaticamente.</p>
          </div>
          <button
            type="button"
            onClick={addFlock}
            className="flex h-12 items-center justify-center gap-2 rounded-lg bg-farm-green px-4 font-semibold text-white shadow-lg shadow-green-900/10 transition hover:bg-farm-ink"
          >
            <Layers3 className="h-5 w-5" aria-hidden="true" />
            Novo lote
          </button>
        </div>
        <div className="overflow-x-auto">
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
  const { latestFinance, latestRecord, mainFlock, updateFinancialRecord } = useFarmData();
  const lucroDiario = calcularLucroDiario(latestFinance);
  const lucroMensal = latestFinance.receitaMensal - (latestFinance.custoRacao + latestFinance.custoMaoDeObra + latestFinance.energia + latestFinance.medicamentos + latestFinance.outrosCustos) * 30;
  const ovos = latestRecord?.ovosProduzidos ?? 1;
  const aves = mainFlock?.quantidadeAtual ?? defaultFlockSize;
  const custoTotalDia = latestFinance.receitaDiaria - lucroDiario;

  const financeCards = [
    ["Receita diária", formatCurrency(latestFinance.receitaDiaria)],
    ["Receita mensal", formatCurrency(latestFinance.receitaMensal)],
    ["Preço por dúzia", formatCurrency(latestFinance.precoPorDuzia)],
    ["Preço por caixa", formatCurrency(latestFinance.precoPorCaixa)],
    ["Custo de ração", formatCurrency(latestFinance.custoRacao)],
    ["Custo de mão de obra", formatCurrency(latestFinance.custoMaoDeObra)],
    ["Energia", formatCurrency(latestFinance.energia)],
    ["Medicamentos", formatCurrency(latestFinance.medicamentos)],
    ["Outros custos", formatCurrency(latestFinance.outrosCustos)],
    ["Lucro diário estimado", formatCurrency(lucroDiario)],
    ["Lucro mensal estimado", formatCurrency(lucroMensal)],
    ["Custo por ovo", formatCurrency(custoTotalDia / ovos)],
    ["Custo por dúzia", formatCurrency((custoTotalDia / ovos) * 12)],
    ["Custo por ave", formatCurrency(custoTotalDia / aves)],
  ];

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {financeCards.map(([label, value]) => (
          <StatCard key={label} icon={BadgeDollarSign} label={label} value={value} detail="Dado demonstrativo salvo localmente" />
        ))}
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
              <input className="table-input bg-white/70" type="number" value={item.quantidadeAtual} onChange={(event) => updateInventoryItem(item.id, "quantidadeAtual", event.target.value)} aria-label={`Quantidade de ${item.nome}`} />
              <input className="table-input bg-white/70" type="number" value={item.estoqueMinimo} onChange={(event) => updateInventoryItem(item.id, "estoqueMinimo", event.target.value)} aria-label={`Mínimo de ${item.nome}`} />
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

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_0.85fr]">
        <div className="relative min-h-[460px] overflow-hidden rounded-lg border border-stone-200 bg-[#dfead2] p-4">
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
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10" aria-label="Fechar menu">
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
    <button type="button" onClick={onClick} className={`flex h-12 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold transition ${active ? "bg-white text-farm-ink" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
      <Icon className="h-5 w-5" aria-hidden="true" />
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
        className={`h-10 rounded-md px-3 text-sm font-semibold transition ${role === "granjeiro" ? activeClass : inactiveClass}`}
      >
        Granjeiro
      </button>
      <button
        type="button"
        onClick={() => onChange("manager")}
        className={`h-10 rounded-md px-3 text-sm font-semibold transition ${role === "manager" ? activeClass : inactiveClass}`}
      >
        Empresário
      </button>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, detail }: { icon: typeof Egg; label: string; value: string; detail: string }) {
  return (
    <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-stone-500">{label}</p>
          <p className="mt-2 break-words text-2xl font-semibold">{value}</p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-farm-lime text-farm-green">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 text-sm text-stone-500">{detail}</p>
    </article>
  );
}

function ChartPanel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-panel">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-stone-500">{subtitle}</p>
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
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-5 h-64 w-full" role="img" aria-label="Gráfico de produção de ovos">
      {[0, 1, 2, 3].map((line) => (
        <line key={line} x1={padding} x2={width - padding} y1={padding + line * 48} y2={padding + line * 48} stroke="#e7e5df" strokeWidth="1" />
      ))}
      <path d={path} fill="none" stroke="#2f6f4f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
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
    <div className="rounded-lg bg-stone-50 p-3">
      <p className="text-xs font-semibold uppercase text-stone-500">{label}</p>
      <p className="mt-1 break-words text-base font-semibold">{value}</p>
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
    <button onClick={onClick} className={`flex h-11 items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold transition ${active ? "bg-farm-green text-white" : "border border-stone-200 bg-white text-stone-600 hover:border-farm-green hover:text-farm-green"}`}>
      <Icon className="h-4 w-4" aria-hidden="true" />
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
