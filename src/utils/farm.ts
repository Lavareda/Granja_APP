import type { Alert, DailyRecord, FinancialRecord, Flock, FlockPhase, InventoryItem } from "../types";

export function calcularPostura(ovosProduzidos: number, avesAtual: number) {
  if (!avesAtual) return 0;
  return (ovosProduzidos / avesAtual) * 100;
}

export function calcularRacaoPorDuzia(racaoKg: number, ovosProduzidos: number) {
  const duzias = ovosProduzidos / 12;
  return duzias > 0 ? racaoKg / duzias : 0;
}

export function calcularLucroDiario(financeiro: FinancialRecord) {
  return (
    financeiro.receitaDiaria -
    financeiro.custoRacao -
    financeiro.custoMaoDeObra -
    financeiro.energia -
    financeiro.medicamentos -
    financeiro.outrosCustos
  );
}

export function calcularMortalidade(flock: Pick<Flock, "quantidadeInicial" | "quantidadeAtual">) {
  if (!flock.quantidadeInicial) return 0;
  return ((flock.quantidadeInicial - flock.quantidadeAtual) / flock.quantidadeInicial) * 100;
}

export function calcularIdadeLoteSemanas(dataAlojamento: string, dataReferencia = new Date().toISOString().slice(0, 10)) {
  const alojamento = new Date(`${dataAlojamento}T00:00:00`);
  const referencia = new Date(`${dataReferencia}T00:00:00`);
  const dias = Math.max(0, (referencia.getTime() - alojamento.getTime()) / 86400000);
  return Math.floor(dias / 7);
}

export function calcularFaseLote(idadeSemanas: number): FlockPhase {
  if (idadeSemanas < 7) return "cria";
  if (idadeSemanas < 18) return "recria";
  return "postura";
}

export function producaoEsperadaPorIdade(idadeSemanas: number) {
  if (idadeSemanas < 18) return 0;
  if (idadeSemanas < 20) return 35;
  if (idadeSemanas < 24) return 72;
  if (idadeSemanas < 36) return 92;
  if (idadeSemanas < 55) return 88;
  if (idadeSemanas < 75) return 82;
  return 74;
}

export function calcularStatusEstoque(item: Pick<InventoryItem, "quantidadeAtual" | "estoqueMinimo">) {
  if (item.quantidadeAtual <= item.estoqueMinimo * 0.5) return "critico";
  if (item.quantidadeAtual <= item.estoqueMinimo) return "atencao";
  return "normal";
}

export function gerarAlertas({
  ultimoRegistro,
  lotePrincipal,
  estoque,
}: {
  ultimoRegistro?: DailyRecord;
  lotePrincipal?: Flock;
  estoque: InventoryItem[];
}): Alert[] {
  const alertas: Alert[] = [];
  const aves = lotePrincipal?.quantidadeAtual ?? 4000;
  const idade = lotePrincipal ? calcularIdadeLoteSemanas(lotePrincipal.dataAlojamento, ultimoRegistro?.data) : 32;
  const postura = ultimoRegistro ? calcularPostura(ultimoRegistro.ovosProduzidos, aves) : 0;
  const esperada = producaoEsperadaPorIdade(idade);
  const racaoPorDuzia = ultimoRegistro ? calcularRacaoPorDuzia(ultimoRegistro.racaoKg, ultimoRegistro.ovosProduzidos) : 0;
  const mortalidadeDia = ultimoRegistro && aves ? (ultimoRegistro.mortalidade / aves) * 100 : 0;
  const racao = estoque.find((item) => item.nome === "Ração");
  const vacinas = estoque.find((item) => item.nome === "Vacinas");

  if (ultimoRegistro && postura < esperada - 4) {
    alertas.push({
      id: "producao-meta",
      titulo: "Produção abaixo da meta",
      detalhe: `${postura.toFixed(1).replace(".", ",")}% real contra ${esperada.toFixed(1).replace(".", ",")}% esperado`,
      status: "atencao",
    });
  }

  if (mortalidadeDia > 0.12) {
    alertas.push({
      id: "mortalidade-alta",
      titulo: "Mortalidade alta",
      detalhe: `${ultimoRegistro?.mortalidade ?? 0} aves registradas no último lançamento`,
      status: "critico",
    });
  }

  if (racaoPorDuzia > 1.7 || racaoPorDuzia < 1.35) {
    alertas.push({
      id: "racao-padrao",
      titulo: "Consumo de ração fora do padrão",
      detalhe: `${racaoPorDuzia.toFixed(2).replace(".", ",")} kg por dúzia`,
      status: "atencao",
    });
  }

  if ((ultimoRegistro?.temperatura ?? 0) >= 29) {
    alertas.push({
      id: "temperatura",
      titulo: "Temperatura elevada",
      detalhe: `${ultimoRegistro?.temperatura.toFixed(1).replace(".", ",")} °C no último lançamento`,
      status: "critico",
    });
  }

  if (racao && calcularStatusEstoque(racao) !== "normal") {
    alertas.push({
      id: "estoque-racao",
      titulo: "Estoque de ração baixo",
      detalhe: `${racao.quantidadeAtual} ${racao.unidade} disponíveis`,
      status: calcularStatusEstoque(racao),
    });
  }

  if (vacinas && calcularStatusEstoque(vacinas) !== "normal") {
    alertas.push({
      id: "vacinacao",
      titulo: "Vacinação pendente",
      detalhe: "Planejar reposição e calendário sanitário do lote",
      status: "atencao",
    });
  }

  if (!alertas.length) {
    alertas.push({
      id: "normal",
      titulo: "Operação normal",
      detalhe: "Indicadores principais dentro dos limites do demo",
      status: "normal",
    });
  }

  return alertas;
}
