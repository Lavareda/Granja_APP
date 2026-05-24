import { Session, User } from "@supabase/supabase-js";
import { createContext, FormEvent, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  BadgeDollarSign,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  Droplets,
  Egg,
  Eye,
  EyeOff,
  Feather,
  FileSpreadsheet,
  Home,
  LogOut,
  Menu,
  NotebookPen,
  Save,
  TrendingUp,
  ThermometerSun,
  Tractor,
  Wheat,
  X,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

type Page = "dashboard" | "daily-record" | "csv";

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

type DailyRecord = {
  id: number;
  data: string;
  lote: string;
  ovosProduzidos: number;
  ovosQuebrados: number;
  mortalidade: number;
  descarte: number;
  racaoKg: number;
  agua: number;
  temperatura: number;
  observacoes: string;
};

type SeriesPoint = {
  label: string;
  value: number;
};

type PerformancePoint = {
  label: string;
  actual: number;
  expected: number;
};

type ProductionPhase = "cria" | "recria" | "postura";

type FarmAlert = {
  title: string;
  detail: string;
  tone: string;
};

type DashboardData = {
  totalEggs: number;
  totalFeed: number;
  totalMortality: number;
  layingPercentage: number;
  latestLayingPercentage: number;
  feedPerDozenEggs: number;
  estimatedDailyProfit: number;
  mortalityPercentage: number;
  flockAgeWeeks: number;
  productionPhase: ProductionPhase;
  eggSeries: SeriesPoint[];
  feedSeries: SeriesPoint[];
  mortalitySeries: SeriesPoint[];
  actualProductionSeries: SeriesPoint[];
  expectedProductionSeries: SeriesPoint[];
  performanceSeries: PerformancePoint[];
  alerts: FarmAlert[];
};

type FarmDataContextValue = {
  records: DailyRecord[];
  latestRecord?: DailyRecord;
  dashboard: DashboardData;
  flockSize: number;
  updateFlockSize: (value: number) => void;
  addDailyRecord: (record: Omit<DailyRecord, "id">) => void;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const defaultFlockSize = 4000;
const flockStartDate = "2025-10-01";
const eggPricePerDozen = 8.5;
const feedCostPerKg = 2.15;
const mortalityCostPerBird = 22;
const recordsStorageKey = "granjaapp.dailyRecords";
const flockSizeStorageKey = "granjaapp.flockSize";
const formStorageKey = "granjaapp.dailyRecordDraft";
const pageStorageKey = "granjaapp.currentPage";
const today = new Date().toISOString().slice(0, 10);

const initialForm: DailyRecordForm = {
  data: today,
  lote: "Lote 18",
  ovosProduzidos: "",
  ovosQuebrados: "",
  mortalidade: "",
  descarte: "",
  racaoKg: "",
  agua: "",
  temperatura: "",
  observacoes: "",
};

const seedRecords: DailyRecord[] = [
  {
    id: 1,
    data: "2026-05-17",
    lote: "Lote 18",
    ovosProduzidos: 3420,
    ovosQuebrados: 38,
    mortalidade: 1,
    descarte: 6,
    racaoKg: 455,
    agua: 910,
    temperatura: 24.3,
    observacoes: "Coleta normal.",
  },
  {
    id: 2,
    data: "2026-05-18",
    lote: "Lote 18",
    ovosProduzidos: 3510,
    ovosQuebrados: 35,
    mortalidade: 0,
    descarte: 5,
    racaoKg: 462,
    agua: 918,
    temperatura: 24.7,
    observacoes: "Racao entregue no silo A.",
  },
  {
    id: 3,
    data: "2026-05-19",
    lote: "Lote 18",
    ovosProduzidos: 3465,
    ovosQuebrados: 41,
    mortalidade: 2,
    descarte: 7,
    racaoKg: 449,
    agua: 906,
    temperatura: 25.1,
    observacoes: "",
  },
  {
    id: 4,
    data: "2026-05-20",
    lote: "Lote 18",
    ovosProduzidos: 3588,
    ovosQuebrados: 44,
    mortalidade: 1,
    descarte: 8,
    racaoKg: 470,
    agua: 930,
    temperatura: 24.8,
    observacoes: "Ventilacao ajustada no galpao 2.",
  },
];

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
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function escapeCsvValue(value: string | number) {
  const stringValue = String(value);
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function buildRecordsCsv(records: DailyRecord[]) {
  const headers = [
    "Data",
    "Lote",
    "Ovos produzidos",
    "Ovos quebrados",
    "Mortalidade",
    "Descarte",
    "Consumo de ração kg",
    "Consumo de água",
    "Temperatura",
    "Observações",
  ];
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

function exportRecordsToCsv(records: DailyRecord[]) {
  const csv = buildRecordsCsv(records);
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `granjaapp-registros-${today}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function dateLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
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

function isDailyRecordList(value: unknown): value is DailyRecord[] {
  return Array.isArray(value) && value.every((record) => {
    if (!record || typeof record !== "object") return false;

    const candidate = record as Partial<DailyRecord>;
    return (
      typeof candidate.id === "number" &&
      typeof candidate.data === "string" &&
      typeof candidate.lote === "string" &&
      typeof candidate.ovosProduzidos === "number" &&
      typeof candidate.ovosQuebrados === "number" &&
      typeof candidate.mortalidade === "number" &&
      typeof candidate.descarte === "number" &&
      typeof candidate.racaoKg === "number" &&
      typeof candidate.agua === "number" &&
      typeof candidate.temperatura === "number" &&
      typeof candidate.observacoes === "string"
    );
  });
}

function isPage(value: unknown): value is Page {
  return value === "dashboard" || value === "daily-record" || value === "csv";
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isDailyRecordForm(value: unknown): value is DailyRecordForm {
  return Boolean(value && typeof value === "object" && "data" in value && "lote" in value);
}

function getFlockAgeWeeks(date: string) {
  const start = new Date(`${flockStartDate}T00:00:00`);
  const current = new Date(`${date}T00:00:00`);
  const days = Math.max(0, (current.getTime() - start.getTime()) / 86400000);
  return Math.floor(days / 7);
}

function getProductionPhase(ageWeeks: number): ProductionPhase {
  if (ageWeeks < 7) return "cria";
  if (ageWeeks < 18) return "recria";
  return "postura";
}

function getExpectedLayingPercentage(ageWeeks: number) {
  if (ageWeeks < 18) return 0;
  if (ageWeeks < 20) return 35;
  if (ageWeeks < 24) return 72;
  if (ageWeeks < 32) return 92;
  if (ageWeeks < 50) return 90;
  if (ageWeeks < 70) return 84;
  return 76;
}

function buildAlerts({
  latestRecord,
  latestLayingPercentage,
  expectedLayingPercentage,
  mortalityPercentage,
  feedPerDozenEggs,
}: {
  latestRecord?: DailyRecord;
  latestLayingPercentage: number;
  expectedLayingPercentage: number;
  mortalityPercentage: number;
  feedPerDozenEggs: number;
}) {
  if (!latestRecord) return [];

  const alerts: FarmAlert[] = [];

  if (latestLayingPercentage < expectedLayingPercentage - 5) {
    alerts.push({
      title: "Produção abaixo da curva",
      detail: `${formatPercent(latestLayingPercentage)} real vs ${formatPercent(expectedLayingPercentage)} esperado`,
      tone: "border-amber-200 bg-amber-50 text-amber-800",
    });
  }

  if (mortalityPercentage > 0.1) {
    alerts.push({
      title: "Mortalidade alta",
      detail: `${formatPercent(mortalityPercentage)} no último lançamento`,
      tone: "border-red-200 bg-red-50 text-red-800",
    });
  }

  if (feedPerDozenEggs > 1.65) {
    alerts.push({
      title: "Consumo de ração excessivo",
      detail: `${formatNumber(feedPerDozenEggs, 2)} kg por dúzia de ovos`,
      tone: "border-orange-200 bg-orange-50 text-orange-800",
    });
  }

  if (latestRecord.temperatura > 29) {
    alerts.push({
      title: "Temperatura elevada",
      detail: `${formatNumber(latestRecord.temperatura, 1)} °C no galpão`,
      tone: "border-red-200 bg-red-50 text-red-800",
    });
  }

  return alerts;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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
    if (!supabase) {
      throw new Error("Configure o Supabase no arquivo .env para entrar.");
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUp(email: string, password: string) {
    if (!supabase) {
      throw new Error("Configure o Supabase no arquivo .env para criar conta.");
    }

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    if (!supabase) return;

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      signIn,
      signUp,
      signOut,
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}

const FarmDataContext = createContext<FarmDataContextValue | null>(null);

function FarmDataProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<DailyRecord[]>(() =>
    loadFromStorage(recordsStorageKey, seedRecords, isDailyRecordList),
  );
  const [flockSize, setFlockSize] = useState<number>(() =>
    loadFromStorage(flockSizeStorageKey, defaultFlockSize, isPositiveNumber),
  );

  useEffect(() => {
    saveToStorage(recordsStorageKey, records);
  }, [records]);

  useEffect(() => {
    saveToStorage(flockSizeStorageKey, flockSize);
  }, [flockSize]);

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => a.data.localeCompare(b.data)).slice(-7),
    [records],
  );
  const latestRecord = sortedRecords[sortedRecords.length - 1];

  const dashboard = useMemo<DashboardData>(() => {
    const totalEggs = records.reduce((sum, record) => sum + record.ovosProduzidos, 0);
    const totalFeed = records.reduce((sum, record) => sum + record.racaoKg, 0);
    const totalMortality = records.reduce((sum, record) => sum + record.mortalidade, 0);
    const averageLaying = records.length ? (totalEggs / (records.length * flockSize)) * 100 : 0;
    const latestLayingPercentage = latestRecord ? (latestRecord.ovosProduzidos / flockSize) * 100 : 0;
    const latestDozens = latestRecord ? latestRecord.ovosProduzidos / 12 : 0;
    const feedPerDozenEggs = latestRecord && latestDozens ? latestRecord.racaoKg / latestDozens : 0;
    const estimatedDailyProfit = latestRecord
      ? latestDozens * eggPricePerDozen - latestRecord.racaoKg * feedCostPerKg - latestRecord.mortalidade * mortalityCostPerBird
      : 0;
    const mortalityPercentage = latestRecord ? (latestRecord.mortalidade / flockSize) * 100 : 0;
    const flockAgeWeeks = latestRecord ? getFlockAgeWeeks(latestRecord.data) : getFlockAgeWeeks(today);
    const productionPhase = getProductionPhase(flockAgeWeeks);
    const expectedLayingPercentage = getExpectedLayingPercentage(flockAgeWeeks);
    const performanceSeries = sortedRecords.map((record) => {
      const ageWeeks = getFlockAgeWeeks(record.data);
      return {
        label: dateLabel(record.data),
        actual: (record.ovosProduzidos / flockSize) * 100,
        expected: getExpectedLayingPercentage(ageWeeks),
      };
    });

    return {
      totalEggs,
      totalFeed,
      totalMortality,
      layingPercentage: averageLaying,
      latestLayingPercentage,
      feedPerDozenEggs,
      estimatedDailyProfit,
      mortalityPercentage,
      flockAgeWeeks,
      productionPhase,
      eggSeries: sortedRecords.map((record) => ({ label: dateLabel(record.data), value: record.ovosProduzidos })),
      feedSeries: sortedRecords.map((record) => ({ label: dateLabel(record.data), value: record.racaoKg })),
      mortalitySeries: sortedRecords.map((record) => ({ label: dateLabel(record.data), value: record.mortalidade })),
      actualProductionSeries: performanceSeries.map((point) => ({ label: point.label, value: point.actual })),
      expectedProductionSeries: performanceSeries.map((point) => ({ label: point.label, value: point.expected })),
      performanceSeries,
      alerts: buildAlerts({
        latestRecord,
        latestLayingPercentage,
        expectedLayingPercentage,
        mortalityPercentage,
        feedPerDozenEggs,
      }),
    };
  }, [records, sortedRecords, latestRecord, flockSize]);

  function addDailyRecord(record: Omit<DailyRecord, "id">) {
    setRecords((current) => [...current, { ...record, id: Date.now() }]);
  }

  function updateFlockSize(value: number) {
    setFlockSize(Math.max(1, Math.round(value)));
  }

  const value = useMemo(
    () => ({ records, latestRecord, dashboard, flockSize, updateFlockSize, addDailyRecord }),
    [records, latestRecord, dashboard, flockSize],
  );

  return <FarmDataContext.Provider value={value}>{children}</FarmDataContext.Provider>;
}

function useFarmData() {
  const context = useContext(FarmDataContext);

  if (!context) {
    throw new Error("useFarmData must be used inside FarmDataProvider");
  }

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

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

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
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/dashboard";

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

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
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
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Não foi possível autenticar.");
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

        {!isSupabaseConfigured ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no `.env` para ativar a autenticação.
          </div>
        ) : null}

        {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div> : null}
        {message ? <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">{message}</div> : null}

        <form onSubmit={handleAuthSubmit} className="space-y-4">
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@sitiodobem.com"
              className="field-input"
            />
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
                className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-farm-green"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                title={showPassword ? "Ocultar senha" : "Mostrar senha"}
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
  const [page, setPage] = useState<Page>(() => loadFromStorage(pageStorageKey, "dashboard", isPage));
  const [form, setForm] = useState<DailyRecordForm>(() => ({
    ...initialForm,
    ...loadFromStorage(formStorageKey, initialForm, isDailyRecordForm),
  }));
  const [errors, setErrors] = useState<Partial<Record<keyof DailyRecordForm, string>>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { addDailyRecord } = useFarmData();
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  useEffect(() => {
    saveToStorage(pageStorageKey, page);
  }, [page]);

  useEffect(() => {
    saveToStorage(formStorageKey, form);
  }, [form]);

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

      if (!value) {
        nextErrors[field] = `Informe ${fieldLabels[field].toLowerCase()}.`;
      } else if (Number.isNaN(numberValue) || numberValue < 0) {
        nextErrors[field] = "Use um número maior ou igual a zero.";
      }
    });

    return nextErrors;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setShowSuccess(false);
      return;
    }

    const newRecord: Omit<DailyRecord, "id"> = {
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

    addDailyRecord(newRecord);
    setForm({ ...initialForm, data: form.data, lote: form.lote });
    setShowSuccess(true);
  }

  async function handleLogout() {
    await signOut();
    setIsSidebarOpen(false);
    navigate("/login");
  }

  function goToPage(nextPage: Page) {
    setPage(nextPage);
    setIsSidebarOpen(false);
    navigate(nextPage === "dashboard" ? "/dashboard" : nextPage === "daily-record" ? "/daily-record" : "/csv");
  }

  const pageTitle = page === "dashboard" ? "Painel da granja" : page === "daily-record" ? "Registro diário" : "Arquivo CSV";

  return (
    <div className="min-h-screen bg-[#f6f7f2] text-farm-ink">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-[#f6f7f2]/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white shadow-sm sm:hidden"
              aria-label="Abrir menu"
              aria-expanded={isSidebarOpen}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium text-farm-green">
                <Tractor className="h-4 w-4" aria-hidden="true" />
                GranjaApp · Sítio do Bem
              </p>
              <h1 className="truncate text-2xl font-semibold text-farm-ink">{pageTitle}</h1>
              <h1 className="hidden">
                {page === "dashboard" ? "Painel da granja" : "Registro diário"}
              </h1>
            </div>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="rounded-lg bg-farm-lime px-3 py-2 text-sm font-semibold text-farm-green">
              {user?.email ?? "Usuário"}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-600 transition hover:border-farm-green hover:text-farm-green"
            >
              Sair
            </button>
          </div>
        </div>
        <nav className="mx-auto mt-4 hidden max-w-6xl grid-cols-3 gap-2 sm:grid">
          <TabButton active={page === "dashboard"} icon={Home} label="Painel" onClick={() => goToPage("dashboard")} />
          <TabButton
            active={page === "daily-record"}
            icon={NotebookPen}
            label="Registro"
            onClick={() => goToPage("daily-record")}
          />
          <TabButton active={page === "csv"} icon={FileSpreadsheet} label="CSV" onClick={() => goToPage("csv")} />
        </nav>
      </header>

      <MobileSidebar
        isOpen={isSidebarOpen}
        activePage={page}
        userEmail={user?.email}
        onClose={() => setIsSidebarOpen(false)}
        onNavigate={goToPage}
        onLogout={handleLogout}
      />

      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        {showSuccess ? (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Registro salvo e painel atualizado.</p>
              <p className="mt-1 text-sm">Os KPIs e gráficos já refletem o último lançamento local.</p>
            </div>
          </div>
        ) : null}

        {page === "dashboard" ? (
          <DashboardPage onNewRecord={() => goToPage("daily-record")} />
        ) : page === "csv" ? (
          <CsvPage />
        ) : (
          <DailyRecordPage form={form} errors={errors} onChange={updateField} onSubmit={handleSubmit} />
        )}
      </main>
    </div>
  );
}

function DashboardPage({
  onNewRecord,
}: {
  onNewRecord: () => void;
}) {
  const { records, latestRecord, dashboard, flockSize, updateFlockSize } = useFarmData();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Resumo operacional</h2>
          <p className="mt-1 text-sm text-stone-500">
            Dados conectados aos {records.length} registros diários locais.
          </p>
        </div>
        <button
          onClick={onNewRecord}
          className="flex h-12 items-center justify-center gap-2 rounded-lg bg-farm-green px-4 font-semibold text-white shadow-lg shadow-green-900/10 transition hover:bg-farm-ink"
        >
          <NotebookPen className="h-5 w-5" aria-hidden="true" />
          Novo registro
        </button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Egg} label="Ovos produzidos" value={formatNumber(dashboard.totalEggs)} detail="Total registrado" />
        <StatCard icon={BarChart3} label="Postura atual" value={formatPercent(dashboard.latestLayingPercentage)} detail={`${formatPercent(dashboard.layingPercentage)} média do período`} />
        <StatCard icon={Wheat} label="Ração por dúzia" value={`${formatNumber(dashboard.feedPerDozenEggs, 2)} kg`} detail={`${formatNumber(dashboard.totalFeed, 1)} kg no período`} />
        <StatCard icon={BadgeDollarSign} label="Lucro diário estimado" value={formatCurrency(dashboard.estimatedDailyProfit)} detail="Receita de ovos menos ração e perdas" />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Feather} label="Mortalidade" value={formatPercent(dashboard.mortalityPercentage)} detail={`${formatNumber(dashboard.totalMortality)} aves registradas`} />
        <StatCard icon={CalendarDays} label="Idade do lote" value={`${dashboard.flockAgeWeeks} semanas`} detail={`Fase automática: ${dashboard.productionPhase}`} />
        <StatCard icon={TrendingUp} label="Curva esperada" value={formatPercent(dashboard.expectedProductionSeries[dashboard.expectedProductionSeries.length - 1]?.value ?? 0)} detail="Meta técnica pela idade do lote" />
        <StatCard icon={ThermometerSun} label="Temperatura" value={latestRecord ? `${formatNumber(latestRecord.temperatura, 1)} °C` : "0,0 °C"} detail="Último lançamento" />
      </section>

      <FlockSizeCard flockSize={flockSize} onSave={updateFlockSize} />

      <section className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <ChartPanel title="Produção de ovos" subtitle="Atualizado ao adicionar registros diários">
          <LineChart data={dashboard.eggSeries} />
        </ChartPanel>
        <ChartPanel title="Consumo de ração" subtitle="Kg por lançamento">
          <BarChart data={dashboard.feedSeries} color="bg-farm-straw" unit="kg" />
        </ChartPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <ChartPanel title="Desempenho produtivo" subtitle="Curva real de postura comparada com a curva esperada">
          <ComparisonChart data={dashboard.performanceSeries} />
        </ChartPanel>
        <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-panel">
          <h2 className="text-lg font-semibold">Alertas zootécnicos</h2>
          <p className="mt-1 text-sm text-stone-500">Gerados automaticamente pelo último lançamento.</p>
          <div className="mt-4 space-y-3">
            {dashboard.alerts.length ? (
              dashboard.alerts.map((alert) => <AlertCard key={alert.title} alert={alert} />)
            ) : (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                <p className="font-semibold">Sem alertas críticos</p>
                <p className="mt-1 text-sm">Produção, mortalidade, ração e temperatura dentro dos limites.</p>
              </div>
            )}
          </div>
        </section>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
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
              <InfoRow label="Postura" value={formatPercent((latestRecord.ovosProduzidos / flockSize) * 100)} />
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

function FlockSizeCard({ flockSize, onSave }: { flockSize: number; onSave: (value: number) => void }) {
  const [draft, setDraft] = useState(String(flockSize));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(String(flockSize));
  }, [flockSize]);

  function handleSave() {
    const nextValue = Number(draft);

    if (!Number.isFinite(nextValue) || nextValue < 1) {
      setError("Informe um plantel maior que zero.");
      setSaved(false);
      return;
    }

    onSave(nextValue);
    setError("");
    setSaved(true);
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-panel">
      <div className="grid gap-4 md:grid-cols-[1fr_260px_auto] md:items-end">
        <div>
          <h2 className="text-lg font-semibold">Plantel ativo</h2>
          <p className="mt-1 text-sm text-stone-500">
            Usado nos cálculos de postura, mortalidade percentual e comparação com a curva esperada.
          </p>
        </div>
        <Field label="Quantidade de aves" error={error}>
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setError("");
              setSaved(false);
            }}
            className="field-input"
          />
        </Field>
        <button
          type="button"
          onClick={handleSave}
          className="flex h-14 items-center justify-center gap-2 rounded-lg bg-farm-green px-5 font-semibold text-white shadow-lg shadow-green-900/10 transition hover:bg-farm-ink"
        >
          <Save className="h-5 w-5" aria-hidden="true" />
          Salvar plantel
        </button>
      </div>
      {saved ? (
        <p className="mt-3 text-sm font-medium text-emerald-700">Plantel atualizado para {formatNumber(flockSize)} aves.</p>
      ) : null}
    </section>
  );
}

function CsvPage() {
  const { records } = useFarmData();
  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => b.data.localeCompare(a.data)),
    [records],
  );
  const csvContent = useMemo(() => buildRecordsCsv(sortedRecords), [sortedRecords]);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-panel">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-farm-green">
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              Registros salvos em localStorage
            </p>
            <h2 className="mt-1 text-xl font-semibold">Arquivo CSV</h2>
            <p className="mt-1 text-sm text-stone-500">
              Acesse, confira e baixe o CSV gerado com todos os registros diários.
            </p>
          </div>
          <button
            onClick={() => exportRecordsToCsv(sortedRecords)}
            disabled={!sortedRecords.length}
            className="flex h-12 items-center justify-center gap-2 rounded-lg bg-farm-green px-4 font-semibold text-white shadow-lg shadow-green-900/10 transition hover:bg-farm-ink disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            <Download className="h-5 w-5" aria-hidden="true" />
            Baixar CSV
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <SummaryTile icon={FileSpreadsheet} label="Registros" value={formatNumber(sortedRecords.length)} />
          <SummaryTile icon={CalendarDays} label="Mais recente" value={sortedRecords[0]?.data ?? "-"} />
          <SummaryTile icon={Egg} label="Ovos no arquivo" value={formatNumber(sortedRecords.reduce((sum, record) => sum + record.ovosProduzidos, 0))} />
        </div>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-panel">
        <h2 className="text-lg font-semibold">Prévia do CSV</h2>
        <textarea
          readOnly
          value={csvContent}
          className="mt-4 h-72 w-full resize-none rounded-lg border border-stone-200 bg-stone-50 p-4 font-mono text-xs text-stone-700 outline-none"
        />
      </section>

      <section className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-panel">
        <div className="border-b border-stone-200 p-5">
          <h2 className="text-lg font-semibold">Registros no arquivo</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Lote</th>
                <th className="px-4 py-3">Ovos</th>
                <th className="px-4 py-3">Quebrados</th>
                <th className="px-4 py-3">Mortalidade</th>
                <th className="px-4 py-3">Ração kg</th>
                <th className="px-4 py-3">Água</th>
                <th className="px-4 py-3">Temp.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {sortedRecords.map((record) => (
                <tr key={record.id}>
                  <td className="px-4 py-3 font-medium">{record.data}</td>
                  <td className="px-4 py-3">{record.lote}</td>
                  <td className="px-4 py-3">{formatNumber(record.ovosProduzidos)}</td>
                  <td className="px-4 py-3">{formatNumber(record.ovosQuebrados)}</td>
                  <td className="px-4 py-3">{formatNumber(record.mortalidade)}</td>
                  <td className="px-4 py-3">{formatNumber(record.racaoKg, 1)}</td>
                  <td className="px-4 py-3">{formatNumber(record.agua, 1)}</td>
                  <td className="px-4 py-3">{formatNumber(record.temperatura, 1)} °C</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MobileSidebar({
  isOpen,
  activePage,
  userEmail,
  onClose,
  onNavigate,
  onLogout,
}: {
  isOpen: boolean;
  activePage: Page;
  userEmail?: string;
  onClose: () => void;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}) {
  return (
    <div className={`fixed inset-0 z-40 sm:hidden ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
      <button
        type="button"
        onClick={onClose}
        className={`absolute inset-0 bg-farm-ink/45 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        aria-label="Fechar menu"
      />
      <aside
        className={`absolute left-0 top-0 flex h-full w-80 max-w-[86vw] flex-col bg-farm-ink text-white shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
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
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 space-y-2 px-4 py-5">
          <MobileNavButton
            active={activePage === "dashboard"}
            icon={Home}
            label="Painel"
            onClick={() => onNavigate("dashboard")}
          />
          <MobileNavButton
            active={activePage === "daily-record"}
            icon={NotebookPen}
            label="Registro diário"
            onClick={() => onNavigate("daily-record")}
          />
          <MobileNavButton
            active={activePage === "csv"}
            icon={FileSpreadsheet}
            label="Arquivo CSV"
            onClick={() => onNavigate("csv")}
          />
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 rounded-lg bg-white/8 p-3">
            <p className="text-xs text-white/55">Usuário</p>
            <p className="truncate text-sm font-semibold">{userEmail ?? "Conta conectada"}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/10 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sair
          </button>
        </div>
      </aside>
    </div>
  );
}

function MobileNavButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Egg;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-12 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold transition ${
        active ? "bg-white text-farm-ink" : "text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      {label}
    </button>
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
  const { flockSize, records } = useFarmData();
  const postura = useMemo(() => {
    const ovos = parseNumber(form.ovosProduzidos);
    return ovos ? formatPercent((ovos / flockSize) * 100) : "0,0%";
  }, [form.ovosProduzidos, flockSize]);

  return (
    <>
      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <SummaryTile icon={Egg} label="Postura estimada" value={postura} />
        <SummaryTile icon={Feather} label="Plantel ativo" value={formatNumber(flockSize)} />
        <SummaryTile icon={CalendarDays} label="Lançamento" value="Hoje" />
      </section>

      <form onSubmit={onSubmit} className="rounded-lg border border-stone-200 bg-white p-4 shadow-panel sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-farm-lime text-farm-green">
            <NotebookPen className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Dados do dia</h2>
            <p className="mt-1 text-sm text-stone-500">Preencha e salve para atualizar o painel.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data" error={errors.data}>
            <input type="date" value={form.data} onChange={(event) => onChange("data", event.target.value)} className="field-input" />
          </Field>

          <Field label="Lote" error={errors.lote}>
            <select value={form.lote} onChange={(event) => onChange("lote", event.target.value)} className="field-input">
              <option value="">Selecione</option>
              <option>Lote 18</option>
              <option>Lote 19</option>
              <option>Lote Recria</option>
            </select>
          </Field>

          <NumberField label="Ovos produzidos" icon={Egg} value={form.ovosProduzidos} error={errors.ovosProduzidos} placeholder="Ex: 3588" onChange={(value) => onChange("ovosProduzidos", value)} />
          <NumberField label="Ovos quebrados" icon={AlertCircle} value={form.ovosQuebrados} error={errors.ovosQuebrados} placeholder="Ex: 42" onChange={(value) => onChange("ovosQuebrados", value)} />
          <NumberField label="Mortalidade" icon={Feather} value={form.mortalidade} error={errors.mortalidade} placeholder="Ex: 3" onChange={(value) => onChange("mortalidade", value)} />
          <NumberField label="Descarte" icon={ClipboardList} value={form.descarte} error={errors.descarte} placeholder="Ex: 8" onChange={(value) => onChange("descarte", value)} />
          <NumberField label="Consumo de ração (kg)" icon={Wheat} value={form.racaoKg} error={errors.racaoKg} placeholder="Ex: 470" onChange={(value) => onChange("racaoKg", value)} />
          <NumberField label="Consumo de água" icon={Droplets} value={form.agua} error={errors.agua} placeholder="Ex: 920" onChange={(value) => onChange("agua", value)} />
          <NumberField label="Temperatura" icon={ThermometerSun} value={form.temperatura} error={errors.temperatura} placeholder="Ex: 24,8" onChange={(value) => onChange("temperatura", value)} />

          <Field label="Observações" error={errors.observacoes} className="sm:col-span-2">
            <textarea
              value={form.observacoes}
              onChange={(event) => onChange("observacoes", event.target.value)}
              rows={4}
              placeholder="Anote manejo, manutenção, qualidade dos ovos ou qualquer ocorrência."
              className="field-input resize-none"
            />
          </Field>
        </div>

        <div className="sticky bottom-0 -mx-4 mt-6 border-t border-stone-200 bg-white/95 p-4 backdrop-blur sm:static sm:-mx-6 sm:-mb-6 sm:px-6">
          <button type="submit" className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-farm-green px-5 text-base font-semibold text-white shadow-lg shadow-green-900/10 transition hover:bg-farm-ink">
            <Save className="h-5 w-5" aria-hidden="true" />
            Salvar registro
          </button>
        </div>
      </form>
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Egg;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-stone-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold">{value}</p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-farm-lime text-farm-green">
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
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-5 h-64 w-full" role="img" aria-label="Grafico de producao de ovos">
      {[0, 1, 2, 3].map((line) => (
        <line key={line} x1={padding} x2={width - padding} y1={padding + line * 48} y2={padding + line * 48} stroke="#e7e5df" strokeWidth="1" />
      ))}
      <path d={path} fill="none" stroke="#2f6f4f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
      {points.map((point) => (
        <g key={`${point.label}-${point.value}`}>
          <circle cx={point.x} cy={point.y} r="5" fill="#ffffff" stroke="#2f6f4f" strokeWidth="3" />
          <text x={point.x} y={height - 6} textAnchor="middle" className="fill-stone-500 text-xs">
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function ComparisonChart({ data }: { data: PerformancePoint[] }) {
  const width = 640;
  const height = 230;
  const padding = 30;
  const max = 100;
  const points = data.map((point, index) => {
    const x = data.length === 1 ? width / 2 : padding + (index * (width - padding * 2)) / (data.length - 1);
    const actualY = height - padding - (point.actual / max) * (height - padding * 2);
    const expectedY = height - padding - (point.expected / max) * (height - padding * 2);
    return { ...point, x, actualY, expectedY };
  });
  const actualPath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.actualY}`).join(" ");
  const expectedPath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.expectedY}`).join(" ");

  return (
    <div className="mt-5">
      <div className="mb-3 flex flex-wrap gap-4 text-sm font-medium text-stone-600">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-farm-green" />
          Real
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-farm-clay" />
          Esperada
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full" role="img" aria-label="Curva real e esperada de postura">
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = height - padding - (tick / max) * (height - padding * 2);
          return (
            <g key={tick}>
              <line x1={padding} x2={width - padding} y1={y} y2={y} stroke="#e7e5df" strokeWidth="1" />
              <text x={8} y={y + 4} className="fill-stone-500 text-xs">
                {tick}%
              </text>
            </g>
          );
        })}
        <path d={expectedPath} fill="none" stroke="#b86b4b" strokeDasharray="8 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        <path d={actualPath} fill="none" stroke="#2f6f4f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
        {points.map((point) => (
          <g key={`${point.label}-${point.actual}-${point.expected}`}>
            <circle cx={point.x} cy={point.actualY} r="5" fill="#ffffff" stroke="#2f6f4f" strokeWidth="3" />
            <text x={point.x} y={height - 6} textAnchor="middle" className="fill-stone-500 text-xs">
              {point.label}
            </text>
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

function AlertCard({ alert }: { alert: FarmAlert }) {
  return (
    <article className={`flex gap-3 rounded-lg border p-4 ${alert.tone}`}>
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        <h3 className="font-semibold">{alert.title}</h3>
        <p className="mt-1 text-sm opacity-85">{alert.detail}</p>
      </div>
    </article>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-stone-50 p-3">
      <p className="text-xs font-semibold uppercase text-stone-500">{label}</p>
      <p className="mt-1 text-base font-semibold">{value}</p>
    </div>
  );
}

function SummaryTile({ icon: Icon, label, value }: { icon: typeof Egg; label: string; value: string }) {
  return (
    <article className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-farm-sky text-sky-700">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm text-stone-500">{label}</p>
          <p className="text-xl font-semibold text-farm-ink">{value}</p>
        </div>
      </div>
    </article>
  );
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Egg;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition ${
        active ? "bg-farm-green text-white" : "border border-stone-200 bg-white text-stone-600"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function Field({
  label,
  error,
  className = "",
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-semibold text-farm-ink">{label}</span>
      {children}
      {error ? <span className="mt-2 block text-sm font-medium text-red-600">{error}</span> : null}
    </label>
  );
}

function NumberField({
  label,
  icon: Icon,
  value,
  error,
  placeholder,
  onChange,
}: {
  label: string;
  icon: typeof Egg;
  value: string;
  error?: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} error={error}>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
        <input
          type="number"
          min="0"
          step="0.1"
          inputMode="decimal"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="field-input pl-12"
        />
      </div>
    </Field>
  );
}

export default App;
