import { FormEvent, ReactNode, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Droplets,
  Egg,
  Feather,
  Home,
  Menu,
  NotebookPen,
  Save,
  ThermometerSun,
  Tractor,
  Wheat,
} from "lucide-react";

type Page = "dashboard" | "daily-record";

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

const flockSize = 4000;
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

function dateLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [records, setRecords] = useState<DailyRecord[]>(seedRecords);
  const [form, setForm] = useState<DailyRecordForm>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof DailyRecordForm, string>>>({});
  const [showSuccess, setShowSuccess] = useState(false);

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => a.data.localeCompare(b.data)).slice(-7),
    [records],
  );
  const latestRecord = sortedRecords[sortedRecords.length - 1];

  const dashboard = useMemo(() => {
    const totalEggs = records.reduce((sum, record) => sum + record.ovosProduzidos, 0);
    const totalFeed = records.reduce((sum, record) => sum + record.racaoKg, 0);
    const totalMortality = records.reduce((sum, record) => sum + record.mortalidade, 0);
    const averageLaying = records.length ? totalEggs / (records.length * flockSize) * 100 : 0;

    return {
      totalEggs,
      totalFeed,
      totalMortality,
      layingPercentage: averageLaying,
      eggSeries: sortedRecords.map((record) => ({ label: dateLabel(record.data), value: record.ovosProduzidos })),
      feedSeries: sortedRecords.map((record) => ({ label: dateLabel(record.data), value: record.racaoKg })),
      mortalitySeries: sortedRecords.map((record) => ({ label: dateLabel(record.data), value: record.mortalidade })),
    };
  }, [records, sortedRecords]);

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

    const newRecord: DailyRecord = {
      id: Date.now(),
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

    setRecords((current) => [...current, newRecord]);
    setForm({ ...initialForm, data: form.data, lote: form.lote });
    setShowSuccess(true);
    setPage("dashboard");
  }

  return (
    <div className="min-h-screen bg-[#f6f7f2] text-farm-ink">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-[#f6f7f2]/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white shadow-sm">
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium text-farm-green">
                <Tractor className="h-4 w-4" aria-hidden="true" />
                GranjaApp · Sítio do Bem
              </p>
              <h1 className="truncate text-2xl font-semibold text-farm-ink">
                {page === "dashboard" ? "Painel da granja" : "Registro diário"}
              </h1>
            </div>
          </div>
          <span className="hidden rounded-lg bg-farm-lime px-3 py-2 text-sm font-semibold text-farm-green sm:inline-flex">
            {formatNumber(flockSize)} aves
          </span>
        </div>
        <nav className="mx-auto mt-4 grid max-w-6xl grid-cols-2 gap-2">
          <TabButton active={page === "dashboard"} icon={Home} label="Painel" onClick={() => setPage("dashboard")} />
          <TabButton
            active={page === "daily-record"}
            icon={NotebookPen}
            label="Registro"
            onClick={() => setPage("daily-record")}
          />
        </nav>
      </header>

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
          <DashboardPage records={records} latestRecord={latestRecord} dashboard={dashboard} onNewRecord={() => setPage("daily-record")} />
        ) : (
          <DailyRecordPage form={form} errors={errors} onChange={updateField} onSubmit={handleSubmit} />
        )}
      </main>
    </div>
  );
}

function DashboardPage({
  records,
  latestRecord,
  dashboard,
  onNewRecord,
}: {
  records: DailyRecord[];
  latestRecord?: DailyRecord;
  dashboard: {
    totalEggs: number;
    totalFeed: number;
    totalMortality: number;
    layingPercentage: number;
    eggSeries: SeriesPoint[];
    feedSeries: SeriesPoint[];
    mortalitySeries: SeriesPoint[];
  };
  onNewRecord: () => void;
}) {
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
        <StatCard icon={BarChart3} label="Postura média" value={formatPercent(dashboard.layingPercentage)} detail="Sobre 4.000 poedeiras" />
        <StatCard icon={Wheat} label="Ração consumida" value={`${formatNumber(dashboard.totalFeed, 1)} kg`} detail="Total registrado" />
        <StatCard icon={Feather} label="Mortalidade" value={formatNumber(dashboard.totalMortality)} detail="Aves registradas" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <ChartPanel title="Produção de ovos" subtitle="Atualizado ao adicionar registros diários">
          <LineChart data={dashboard.eggSeries} />
        </ChartPanel>
        <ChartPanel title="Consumo de ração" subtitle="Kg por lançamento">
          <BarChart data={dashboard.feedSeries} color="bg-farm-straw" unit="kg" />
        </ChartPanel>
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
  const postura = useMemo(() => {
    const ovos = parseNumber(form.ovosProduzidos);
    return ovos ? formatPercent((ovos / flockSize) * 100) : "0,0%";
  }, [form.ovosProduzidos]);

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
