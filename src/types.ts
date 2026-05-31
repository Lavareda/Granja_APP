export type Page =
  | "dashboard"
  | "records"
  | "flocks"
  | "finance"
  | "inventory"
  | "reports"
  | "map"
  | "settings"
  | "permissions";

export type AccessRole = "empresario" | "granjeiro";

export type UserProfile = {
  id: string;
  email: string;
  role: AccessRole;
  fullName?: string | null;
  isProtected?: boolean;
};

export type AlertStatus = "normal" | "atencao" | "critico";

export type FlockPhase = "cria" | "recria" | "postura";

export type DailyRecord = {
  /** Local integer id — stable hash of supabaseId when from Supabase, or Date.now() in demo mode. */
  id: number;
  /** Supabase UUID — present when the record was loaded from or saved to the database. */
  supabaseId?: string;
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

export type Flock = {
  id: number;
  nome: string;
  dataAlojamento: string;
  linhagem: string;
  quantidadeInicial: number;
  quantidadeAtual: number;
  status: "ativo" | "observacao" | "encerrado";
};

export type FinancialRecord = {
  id: number;
  data: string;
  receitaDiaria: number;
  receitaMensal: number;
  precoPorDuzia: number;
  precoPorCaixa: number;
  custoRacao: number;
  custoMaoDeObra: number;
  energia: number;
  medicamentos: number;
  outrosCustos: number;
};

export type EggSale = {
  id: number;
  dataVenda: string;
  cliente: string;
  quantidadeDuzias: number;
  quantidadeCaixas: number;
  precoPorDuzia: number;
  precoPorCaixa: number;
  valorTotal: number;
  formaPagamento: "pix" | "dinheiro" | "cartao" | "boleto" | "transferencia";
  status: "pago" | "pendente";
};

export type InventoryItem = {
  id: number;
  nome: string;
  quantidadeAtual: number;
  unidade: string;
  estoqueMinimo: number;
  status: AlertStatus;
};

export type Alert = {
  id: string;
  titulo: string;
  detalhe: string;
  status: AlertStatus;
};

export type FarmArea = {
  id: string;
  nome: string;
  className: string;
  producao: string;
  aves: string;
  temperatura: string;
  estoqueRelacionado: string;
  alertas: Alert[];
};

export type SeriesPoint = {
  label: string;
  value: number;
};

export type PerformancePoint = {
  label: string;
  actual: number;
  expected: number;
};
