import React, { useState, useEffect, useMemo } from "react";
import Dexie from "dexie";
import { PluggyConnect } from "react-pluggy-connect";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
} from "recharts";

// Inicialização da Base de Dados Local
const db = new Dexie("NexusFinDB_Pro");
db.version(1).stores({
  transactions:
    "++id, type, amount, description, category, date, timeString, timestamp",
});

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [pluggyToken, setPluggyToken] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");

  // Estado de Privacidade (Ocultar Valores)
  const [showValues, setShowValues] = useState(true);

  // Filtros
  const [filterType, setFilterType] = useState("Todas as Operações");
  const [filterDate, setFilterDate] = useState("Últimos 30 dias");
  const [filterCategory, setFilterCategory] = useState("Todas");

  // Cores BI
  const COLORS_EXPENSE = [
    "#e11d48",
    "#f43f5e",
    "#fb923c",
    "#f59e0b",
    "#84cc16",
    "#14b8a6",
    "#06b6d4",
    "#6366f1",
    "#a855f7",
    "#ec4899",
  ];
  const COLORS_INCOME = ["#10B981", "#34D399", "#059669", "#047857", "#065F46"];

  const loadData = async () => {
    const allTx = await db.transactions.toArray();
    allTx.sort((a, b) => b.timestamp - a.timestamp);
    setTransactions(allTx);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Função Auxiliar para Mascarar Valores
  const formatMoney = (value) => {
    if (!showValues) return "••••••";
    return value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Motor de Auto-Categorização
  const autoCategorize = (desc, amount) => {
    const d = desc.toLowerCase();
    if (amount > 0) {
      if (
        d.includes("salário") ||
        d.includes("pagamento") ||
        d.includes("ordenado")
      )
        return "Salário";
      if (
        d.includes("rendimento") ||
        d.includes("juros") ||
        d.includes("investimento")
      )
        return "Rendimentos";
      if (d.includes("pix")) return "PIX Recebido";
      if (d.includes("estorno") || d.includes("reembolso")) return "Reembolsos";
      return "Outras Receitas";
    }
    if (
      d.includes("mercado") ||
      d.includes("supermercado") ||
      d.includes("ifood") ||
      d.includes("restaurante") ||
      d.includes("padaria") ||
      d.includes("assai") ||
      d.includes("atacadao")
    )
      return "Alimentação";
    if (
      d.includes("posto") ||
      d.includes("uber") ||
      d.includes("99") ||
      d.includes("gasolina") ||
      d.includes("estacionamento") ||
      d.includes("pedágio")
    )
      return "Transporte";
    if (
      d.includes("vivo") ||
      d.includes("claro") ||
      d.includes("tim") ||
      d.includes("internet") ||
      d.includes("telefone") ||
      d.includes("netflix") ||
      d.includes("spotify")
    )
      return "Assinaturas/Telefonia";
    if (
      d.includes("energia") ||
      d.includes("água") ||
      d.includes("luz") ||
      d.includes("condomínio") ||
      d.includes("iptu") ||
      d.includes("cpfl") ||
      d.includes("sabesp")
    )
      return "Contas Casa";
    if (d.includes("pix")) return "PIX Enviado";
    if (d.includes("fatura") || d.includes("cartão") || d.includes("nubank"))
      return "Cartão de Crédito";
    if (
      d.includes("farmácia") ||
      d.includes("drogaria") ||
      d.includes("saúde") ||
      d.includes("unimed")
    )
      return "Saúde";
    if (
      d.includes("imposto") ||
      d.includes("taxa") ||
      d.includes("tarifa") ||
      d.includes("iof")
    )
      return "Taxas/Impostos";
    return "Outros Gastos";
  };

  const handleImportCSV = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    // Usamos 'windows-1252' para o sistema conseguir ler os acentos (ç, ã) dos bancos tradicionais
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const lines = text.split("\n").filter((line) => line.trim() !== "");
        const newTransactions = [];

        // Inteligência: O sistema lê a 1ª linha para detetar automaticamente de que banco é o CSV
        const isBancoDoBrasil =
          lines[0].includes("Tipo Lançamento") ||
          lines[0].includes("Lançamento");

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];

          // Novo corte inteligente: separa por vírgulas, mas ignora vírgulas dentro de aspas (como nos valores "-1.900,00")
          const cols = line
            .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
            .map((col) => col.replace(/(^"\vert{}"$)/g, "").trim());

          if (cols.length < 3) continue;

          let dataStr, valorStr, descricao;

          if (isBancoDoBrasil) {
            // Ignorar as linhas de "Saldo" que o BB mistura no extrato para não duplicar entradas
            if (
              cols[1].includes("Saldo Anterior") ||
              cols[1].includes("Saldo do dia")
            )
              continue;

            dataStr = cols[0]; // "08/09/2026"
            // Junta a ação com o nome do recebedor (Ex: "Pix Enviado - HOTMART")
            descricao = cols[2] !== "" ? `${cols[1]} - ${cols[2]}` : cols[1];
            valorStr = cols[4]; // "-47,00" ou "2.401,04"
          } else {
            // Lógica original mantida intacta para o Nubank
            dataStr = cols[0];
            valorStr = cols[1];
            descricao = cols[cols.length - 1];
          }

          if (!valorStr) continue;

          // Conversão de dinheiro: Se for formato PT-BR (1.900,00), converte para formato de cálculo de sistema (1900.00)
          let valorTratado = valorStr;
          if (valorTratado.includes(",")) {
            valorTratado = valorTratado.replace(/\./g, "").replace(",", ".");
          }
          const valor = parseFloat(valorTratado);

          if (isNaN(valor) || valor === 0) continue;

          let [dia, mes, ano] = dataStr.split("/");
          if (dia.length === 4) [ano, mes, dia] = dataStr.split("-");
          const txDate = new Date(ano, mes - 1, dia);

          newTransactions.push({
            type: valor < 0 ? "expense" : "income",
            amount: Math.abs(valor),
            description: descricao,
            category: autoCategorize(descricao, valor),
            date: txDate.toISOString(),
            timeString: isBancoDoBrasil ? "CSV BB" : "CSV Nubank",
            timestamp: txDate.getTime(),
          });
        }

        await db.transactions.bulkAdd(newTransactions);
        alert(`Sucesso! ${newTransactions.length} transações importadas.`);
        event.target.value = "";
        loadData();
      } catch (error) {
        console.error("Erro CSV:", error);
        alert("Erro ao importar CSV. Verifique se o formato é suportado.");
      }
    };

    // Inicia a leitura do ficheiro
    reader.readAsText(file, "windows-1252");
  };

  const uniqueCategories = useMemo(
    () => ["Todas", ...new Set(transactions.map((t) => t.category))],
    [transactions],
  );

  // Lógica de Filtros Expandida (com 7 e 15 dias)
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;
    const agora = new Date().getTime();
    const hoje = new Date();

    if (filterType === "Entradas")
      filtered = filtered.filter((t) => t.type === "income");
    if (filterType === "Saídas")
      filtered = filtered.filter((t) => t.type === "expense");
    if (filterCategory !== "Todas")
      filtered = filtered.filter((t) => t.category === filterCategory);

    if (filterDate === "Últimos 7 dias")
      filtered = filtered.filter((t) => t.timestamp >= agora - 7 * 86400000);
    else if (filterDate === "Últimos 15 dias")
      filtered = filtered.filter((t) => t.timestamp >= agora - 15 * 86400000);
    else if (filterDate === "Últimos 30 dias")
      filtered = filtered.filter((t) => t.timestamp >= agora - 30 * 86400000);
    else if (filterDate === "Últimos 90 dias")
      filtered = filtered.filter((t) => t.timestamp >= agora - 90 * 86400000);
    else if (filterDate === "Este Mês")
      filtered = filtered.filter(
        (t) =>
          new Date(t.timestamp).getMonth() === hoje.getMonth() &&
          new Date(t.timestamp).getFullYear() === hoje.getFullYear(),
      );
    else if (filterDate === "Este Ano")
      filtered = filtered.filter(
        (t) => new Date(t.timestamp).getFullYear() === hoje.getFullYear(),
      );

    return filtered.sort((a, b) => a.timestamp - b.timestamp);
  }, [transactions, filterType, filterDate, filterCategory]);

  // KPIs
  const { entradas, saidas } = filteredTransactions.reduce(
    (acc, cur) => {
      if (cur.type === "income") acc.entradas += cur.amount;
      else acc.saidas += cur.amount;
      return acc;
    },
    { entradas: 0, saidas: 0 },
  );

  const saldoAtual = entradas - saidas;
  const margem = entradas > 0 ? ((saldoAtual / entradas) * 100).toFixed(1) : 0;

  // Lógica para colorir saldo negativo/positivo
  const saldoColorClass = saldoAtual < 0 ? "text-rose-500" : "text-emerald-400";
  const marginColorClass =
    saldoAtual < 0
      ? "border-rose-500 border-t-rose-500"
      : "border-slate-700 border-t-indigo-500";

  // Dados para Gráficos
  const evolutionData = useMemo(() => {
    const dailyMap = {};
    filteredTransactions.forEach((tx) => {
      const dateStr = new Date(tx.timestamp).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      });
      if (!dailyMap[dateStr])
        dailyMap[dateStr] = { name: dateStr, Receitas: 0, Despesas: 0 };
      if (tx.type === "income") dailyMap[dateStr].Receitas += tx.amount;
      else dailyMap[dateStr].Despesas += tx.amount;
    });
    return Object.values(dailyMap);
  }, [filteredTransactions]);

  const expenseCategories = useMemo(() => {
    const data = {};
    filteredTransactions
      .filter((t) => t.type === "expense")
      .forEach(
        (tx) => (data[tx.category] = (data[tx.category] || 0) + tx.amount),
      );
    return Object.keys(data)
      .map((k) => ({ name: k, value: data[k] }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-200 p-4 md:p-6 font-sans selection:bg-indigo-500/30 pb-20">
      {/* CABEÇALHO */}
      <header className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              NEXUSFIN
            </h1>
            <p className="text-xs text-slate-400">
              Análise de Receita e Margem
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:gap-3 w-full md:w-auto justify-center">
          {/* Botão Ocultar Valores */}
          <button
            onClick={() => setShowValues(!showValues)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-md transition-all flex items-center border border-slate-700 shadow-sm"
            title={showValues ? "Ocultar Valores" : "Mostrar Valores"}
          >
            {showValues ? (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                />
              </svg>
            )}
          </button>

          {/* Botão Importar */}
          <label className="cursor-pointer bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 shadow-sm">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            Importar CSV
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImportCSV}
            />
          </label>

          {/* Botão Limpar Base */}
          <button
            onClick={handleClearDatabase}
            className="bg-rose-900/30 text-rose-400 border border-rose-800 hover:bg-rose-600 hover:text-white px-3 py-2 rounded-md transition-all flex items-center shadow-sm"
            title="Apagar todos os dados"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* BARRA DE FERRAMENTAS E FILTROS */}
      <div className="flex flex-col lg:flex-row justify-between items-center bg-[#111827] p-3 rounded-lg border border-slate-800 mb-6 gap-4 shadow-sm">
        <div className="flex bg-[#0f172a] rounded p-1 w-full lg:w-auto border border-slate-800">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex-1 px-5 py-2 rounded text-sm font-medium transition-all ${activeTab === "dashboard" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"}`}
          >
            Painel BI
          </button>
          <button
            onClick={() => setActiveTab("extrato")}
            className={`flex-1 px-5 py-2 rounded text-sm font-medium transition-all ${activeTab === "extrato" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"}`}
          >
            Base de Dados
          </button>
        </div>

        <div className="flex flex-wrap lg:flex-nowrap gap-2 w-full lg:w-auto">
          <select
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="bg-[#0f172a] border border-slate-700 rounded p-2 text-sm text-slate-300 focus:border-indigo-500 outline-none flex-1"
          >
            <option>Últimos 7 dias</option>
            <option>Últimos 15 dias</option>
            <option>Últimos 30 dias</option>
            <option>Últimos 90 dias</option>
            <option>Este Mês</option>
            <option>Este Ano</option>
            <option>Desde o Início</option>
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-[#0f172a] border border-slate-700 rounded p-2 text-sm text-slate-300 focus:border-indigo-500 outline-none flex-1"
          >
            {uniqueCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {activeTab === "dashboard" && (
        <div className="animate-fade-in space-y-6">
          {/* CARDS DE KPI */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-indigo-900/40 to-[#111827] p-5 rounded-xl border border-indigo-500/20 shadow-lg">
              <p className="text-slate-400 text-xs font-semibold uppercase mb-1">
                Receita Operacional
              </p>
              <h2 className="text-2xl lg:text-3xl font-bold text-indigo-400">
                R$ {formatMoney(entradas)}
              </h2>
            </div>
            <div className="bg-gradient-to-br from-rose-900/40 to-[#111827] p-5 rounded-xl border border-rose-500/20 shadow-lg">
              <p className="text-slate-400 text-xs font-semibold uppercase mb-1">
                Despesas / Custos
              </p>
              <h2 className="text-2xl lg:text-3xl font-bold text-rose-400">
                R$ {formatMoney(saidas)}
              </h2>
            </div>
            <div
              className={`bg-gradient-to-br p-5 rounded-xl border shadow-lg ${saldoAtual < 0 ? "from-rose-900/20 border-rose-500/20" : "from-emerald-900/20 border-emerald-500/20"}`}
            >
              <p className="text-slate-400 text-xs font-semibold uppercase mb-1">
                Margem / Saldo
              </p>
              <h2
                className={`text-2xl lg:text-3xl font-bold ${saldoColorClass}`}
              >
                R$ {formatMoney(saldoAtual)}
              </h2>
            </div>
            <div className="bg-[#111827] p-5 rounded-xl border border-slate-800 shadow-lg flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs font-semibold uppercase mb-1">
                  % Saúde Financeira
                </p>
                <h2
                  className={`text-3xl font-bold ${saldoAtual < 0 ? "text-rose-400" : "text-slate-100"}`}
                >
                  {showValues ? `${margem}%` : "••%"}
                </h2>
              </div>
              <div
                className={`w-12 h-12 rounded-full border-4 flex items-center justify-center transform rotate-45 ${marginColorClass}`}
              ></div>
            </div>
          </div>

          {/* ÁREA DE GRÁFICOS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="col-span-1 lg:col-span-2 bg-[#111827] p-5 rounded-xl border border-slate-800 shadow-lg h-[350px] lg:h-96">
              <h3 className="text-slate-300 font-medium text-sm mb-4">
                Evolução Mensal
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolutionData}>
                  <defs>
                    <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorDesp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fb7185" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#fb7185" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1e293b"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    stroke="#64748b"
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) =>
                      showValues ? `R$${val / 1000}k` : "•••"
                    }
                  />
                  <RechartsTooltip
                    formatter={(val) =>
                      showValues
                        ? `R$ ${val.toLocaleString("pt-BR")}`
                        : "R$ •••••"
                    }
                    cursor={{ stroke: "#334155" }}
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid #1e293b",
                      borderRadius: "8px",
                      color: "#f1f5f9",
                    }}
                  />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Receitas"
                    stroke="#818cf8"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorRec)"
                  />
                  <Area
                    type="monotone"
                    dataKey="Despesas"
                    stroke="#fb7185"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorDesp)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="col-span-1 bg-[#111827] p-5 rounded-xl border border-slate-800 shadow-lg h-[350px] lg:h-96 flex flex-col">
              <h3 className="text-slate-300 font-medium text-sm mb-2">
                Despesas por Categoria
              </h3>
              {expenseCategories.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseCategories}
                      cx="50%"
                      cy="45%"
                      innerRadius={70}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {expenseCategories.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS_EXPENSE[index % COLORS_EXPENSE.length]}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(val) =>
                        showValues
                          ? `R$ ${val.toLocaleString("pt-BR")}`
                          : "R$ •••••"
                      }
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "1px solid #1e293b",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend
                      layout="horizontal"
                      verticalAlign="bottom"
                      align="center"
                      wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
                  Sem dados.
                </div>
              )}
            </div>
          </div>

          {/* TABELA TOP 10 */}
          <div className="bg-[#111827] rounded-xl border border-slate-800 shadow-lg p-5">
            <h3 className="text-slate-300 font-medium text-sm mb-4">
              Top 10 Maiores Transações
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-[#0f172a] text-slate-400 text-xs uppercase font-medium">
                  <tr>
                    <th className="px-4 py-3 rounded-l-md">Data</th>
                    <th className="px-4 py-3">Descrição</th>
                    <th className="px-4 py-3">Categoria</th>
                    <th className="px-4 py-3 text-right rounded-r-md">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {[...filteredTransactions]
                    .sort((a, b) => b.amount - a.amount)
                    .slice(0, 10)
                    .map((tx, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-slate-400">
                          {new Date(tx.timestamp).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-200">
                          {tx.description}
                        </td>
                        <td className="px-4 py-3">
                          <span className="bg-slate-800 px-2 py-1 rounded text-xs border border-slate-700">
                            {tx.category}
                          </span>
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${tx.type === "income" ? "text-emerald-400" : "text-rose-400"}`}
                        >
                          {tx.type === "income" ? "+" : "-"} R${" "}
                          {formatMoney(tx.amount)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VISTA DE EXTRATO */}
      {activeTab === "extrato" && (
        <div className="bg-[#111827] rounded-xl border border-slate-800 overflow-hidden shadow-lg animate-fade-in">
          <div className="p-4 border-b border-slate-800 bg-[#0f172a] flex justify-between items-center">
            <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
              Base de Dados
            </h2>
            <span className="bg-indigo-500/20 text-indigo-300 text-xs px-3 py-1 rounded-full font-medium">
              {filteredTransactions.length} registros
            </span>
          </div>

          <div className="divide-y divide-slate-800/50 max-h-[70vh] overflow-y-auto">
            {filteredTransactions.map((tx) => (
              <div
                key={tx.id}
                className="p-3 px-5 hover:bg-slate-800/50 flex flex-col sm:flex-row sm:justify-between sm:items-center transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${tx.type === "income" ? "bg-emerald-500" : "bg-rose-500"}`}
                  ></div>
                  <div>
                    <p className="text-slate-200 font-medium text-sm">
                      {tx.description}
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>
                        {new Date(tx.timestamp).toLocaleDateString("pt-BR")}
                      </span>
                      <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                      <span>{tx.category}</span>
                    </p>
                  </div>
                </div>
                <div
                  className={`font-medium text-sm text-right mt-2 sm:mt-0 ${tx.type === "income" ? "text-emerald-400" : "text-rose-400"}`}
                >
                  {tx.type === "income" ? "+" : "-"} R$ {formatMoney(tx.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
