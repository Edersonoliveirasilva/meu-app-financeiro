import React, { useState, useEffect, useMemo } from "react";
import Dexie from "dexie";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
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
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showValues, setShowValues] = useState(true);

  // Filtros
  const [filterDate, setFilterDate] = useState("Este Mês");
  const [filterCategory, setFilterCategory] = useState("Todas");

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

  const loadData = async () => {
    const allTx = await db.transactions.toArray();
    allTx.sort((a, b) => b.timestamp - a.timestamp);
    setTransactions(allTx);
  };

  useEffect(() => {
    loadData();
  }, []);

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
      return "Outras Receitas";
    }
    if (
      d.includes("mercado") ||
      d.includes("supermercado") ||
      d.includes("ifood") ||
      d.includes("restaurante") ||
      d.includes("padaria") ||
      d.includes("assai")
    )
      return "Alimentação";
    if (
      d.includes("posto") ||
      d.includes("uber") ||
      d.includes("99") ||
      d.includes("gasolina") ||
      d.includes("estacionamento")
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
      return "Assinaturas";
    if (
      d.includes("energia") ||
      d.includes("água") ||
      d.includes("luz") ||
      d.includes("condomínio") ||
      d.includes("iptu")
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
    return "Outros Gastos";
  };

  // Importação CSV Inteligente (Nubank e BB)
  const handleImportCSV = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const lines = text.split("\n").filter((line) => line.trim() !== "");
        const newTransactions = [];
        const isBancoDoBrasil =
          lines[0].includes("Tipo Lançamento") ||
          lines[0].includes("Lançamento");

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          const cols = line
            .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
            .map((col) => col.replace(/(^"\vert{}"$)/g, "").trim());

          if (cols.length < 3) continue;

          let dataStr, valorStr, descricao;

          if (isBancoDoBrasil) {
            if (
              cols[1].includes("Saldo Anterior") ||
              cols[1].includes("Saldo do dia")
            )
              continue;
            dataStr = cols[0];
            descricao = cols[2] !== "" ? `${cols[1]} - ${cols[2]}` : cols[1];
            valorStr = cols[4];
          } else {
            dataStr = cols[0];
            valorStr = cols[1];
            descricao = cols[cols.length - 1];
          }

          if (!valorStr) continue;

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
        alert("Erro ao importar CSV.");
      }
    };
    reader.readAsText(file, "windows-1252");
  };

  const handleClearDatabase = async () => {
    if (window.confirm("Apagar TODOS os dados do NexusFin?")) {
      await db.transactions.clear();
      setTransactions([]);
    }
  };

  const uniqueCategories = useMemo(
    () => ["Todas", ...new Set(transactions.map((t) => t.category))],
    [transactions],
  );

  const filteredTransactions = useMemo(() => {
    let filtered = transactions;
    const agora = new Date().getTime();
    const hoje = new Date();

    if (filterCategory !== "Todas")
      filtered = filtered.filter((t) => t.category === filterCategory);

    if (filterDate === "Últimos 7 dias")
      filtered = filtered.filter((t) => t.timestamp >= agora - 7 * 86400000);
    else if (filterDate === "Últimos 15 dias")
      filtered = filtered.filter((t) => t.timestamp >= agora - 15 * 86400000);
    else if (filterDate === "Últimos 30 dias")
      filtered = filtered.filter((t) => t.timestamp >= agora - 30 * 86400000);
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
  }, [transactions, filterDate, filterCategory]);

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

  const saldoColorClass = saldoAtual < 0 ? "text-rose-500" : "text-emerald-400";

  // LÓGICA DO NEXUS SCORE (0 a 100)
  const nexusScore = useMemo(() => {
    if (entradas === 0 && saidas === 0) return 0;
    if (entradas === 0 && saidas > 0) return 15; // Apenas gastou
    let score = 50; // Nota base
    if (margem >= 20)
      score = 95; // Poupou muito bem
    else if (margem >= 10) score = 85;
    else if (margem >= 0)
      score = 70; // Empatou
    else if (margem > -20)
      score = 40; // Gastou um pouco a mais
    else score = 25; // Gastou muito além da conta
    return score;
  }, [entradas, saidas, margem]);

  const scoreColor =
    nexusScore >= 70
      ? "text-emerald-400"
      : nexusScore >= 40
        ? "text-amber-400"
        : "text-rose-500";

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

  // MOTOR DE INSIGHTS (Transforma dados em decisões)
  const insights = useMemo(() => {
    const msgs = [];
    if (entradas === 0 && saidas === 0)
      return [
        {
          type: "info",
          text: "Conecte seu banco ou importe um extrato para gerar inteligência financeira.",
        },
      ];

    if (saidas > entradas && entradas > 0) {
      msgs.push({
        type: "danger",
        icon: "⚠️",
        text: `Atenção: Suas despesas já superaram suas receitas em R$ ${formatMoney(Math.abs(saldoAtual))}.`,
      });
    } else if (margem >= 20) {
      msgs.push({
        type: "success",
        icon: "🟢",
        text: `Excelente! Você está mantendo uma margem livre de ${showValues ? margem + "%" : "••%"}.`,
      });
    }

    if (expenseCategories.length > 0) {
      const topCat = expenseCategories[0];
      const percent = ((topCat.value / saidas) * 100).toFixed(0);
      if (percent > 40) {
        msgs.push({
          type: "warning",
          icon: "🟡",
          text: `Alerta: '${topCat.name}' está consumindo ${showValues ? percent + "%" : "••%"} de todo o seu orçamento.`,
        });
      } else {
        msgs.push({
          type: "info",
          icon: "💡",
          text: `Maior centro de custo atual: '${topCat.name}'.`,
        });
      }
    }
    return msgs;
  }, [entradas, saidas, margem, expenseCategories, saldoAtual, showValues]);

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

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-200 p-4 md:p-6 font-sans pb-20">
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
            <p className="text-xs text-indigo-400 font-medium tracking-wide">
              Inteligência Financeira Ativa
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:gap-3 w-full md:w-auto justify-center">
          <button
            onClick={() => setShowValues(!showValues)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-md transition-all border border-slate-700"
          >
            {showValues ? "Ocultar Valores" : "Mostrar Valores"}
          </button>
          <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-all shadow-lg shadow-indigo-500/20">
            + Importar CSV
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImportCSV}
            />
          </label>
          <button
            onClick={handleClearDatabase}
            className="bg-rose-900/30 text-rose-400 border border-rose-800 hover:bg-rose-600 hover:text-white px-3 py-2 rounded-md"
          >
            Limpar Dados
          </button>
        </div>
      </header>

      {/* FILTROS */}
      <div className="flex flex-col lg:flex-row justify-between items-center bg-[#111827] p-3 rounded-lg border border-slate-800 mb-6 gap-4">
        <div className="flex bg-[#0f172a] rounded p-1 w-full lg:w-auto border border-slate-800">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex-1 px-5 py-2 rounded text-sm font-medium transition-all ${activeTab === "dashboard" ? "bg-indigo-600 text-white" : "text-slate-400"}`}
          >
            Visão Executiva
          </button>
          <button
            onClick={() => setActiveTab("extrato")}
            className={`flex-1 px-5 py-2 rounded text-sm font-medium transition-all ${activeTab === "extrato" ? "bg-indigo-600 text-white" : "text-slate-400"}`}
          >
            Extrato Base
          </button>
        </div>
        <div className="flex gap-2 w-full lg:w-auto">
          <select
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="bg-[#0f172a] border border-slate-700 rounded p-2 text-sm text-slate-300 focus:border-indigo-500 outline-none flex-1"
          >
            <option>Últimos 15 dias</option>
            <option>Últimos 30 dias</option>
            <option>Este Mês</option>
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
          {/* SESSÃO DE INSIGHTS (O DIFERENCIAL DO PITCH) */}
          {insights.length > 0 && (
            <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-xl p-4 flex flex-col gap-2">
              <h3 className="text-xs uppercase text-indigo-400 font-bold tracking-wider mb-1">
                Nexus Insights
              </h3>
              {insights.map((insight, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-sm text-slate-300 bg-[#0f172a] p-3 rounded-lg border border-slate-800/50"
                >
                  <span>{insight.icon}</span>
                  <p>{insight.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* CARDS COM NEXUS SCORE */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* NOVO: NEXUS SCORE CARD */}
            <div className="bg-[#111827] p-5 rounded-xl border border-slate-800 shadow-lg flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full"></div>
              <p className="text-slate-400 text-xs font-semibold uppercase mb-1">
                Nexus Score
              </p>
              <div className="flex items-end gap-2">
                <h2 className={`text-4xl font-bold ${scoreColor}`}>
                  {showValues ? nexusScore : "••"}
                </h2>
                <span className="text-slate-500 font-medium mb-1">/100</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Medidor de saúde financeira
              </p>
            </div>

            <div className="bg-gradient-to-br from-indigo-900/20 to-[#111827] p-5 rounded-xl border border-indigo-500/10 shadow-lg">
              <p className="text-slate-400 text-xs font-semibold uppercase mb-1">
                Receitas
              </p>
              <h2 className="text-2xl font-bold text-indigo-400">
                R$ {formatMoney(entradas)}
              </h2>
            </div>

            <div className="bg-gradient-to-br from-rose-900/20 to-[#111827] p-5 rounded-xl border border-rose-500/10 shadow-lg">
              <p className="text-slate-400 text-xs font-semibold uppercase mb-1">
                Despesas
              </p>
              <h2 className="text-2xl font-bold text-rose-400">
                R$ {formatMoney(saidas)}
              </h2>
            </div>

            <div
              className={`bg-gradient-to-br p-5 rounded-xl border shadow-lg ${saldoAtual < 0 ? "from-rose-900/20 border-rose-500/20" : "from-emerald-900/20 border-emerald-500/20"}`}
            >
              <p className="text-slate-400 text-xs font-semibold uppercase mb-1">
                Disponível
              </p>
              <h2 className={`text-2xl font-bold ${saldoColorClass}`}>
                R$ {formatMoney(saldoAtual)}
              </h2>
            </div>
          </div>

          {/* GRÁFICOS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="col-span-1 lg:col-span-2 bg-[#111827] p-5 rounded-xl border border-slate-800 shadow-lg h-[350px]">
              <h3 className="text-slate-300 font-medium text-sm mb-4">
                Fluxo de Caixa no Tempo
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
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fontSize: 12 }}
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
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid #1e293b",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: "12px" }}
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

            <div className="col-span-1 bg-[#111827] p-5 rounded-xl border border-slate-800 shadow-lg h-[350px] flex flex-col">
              <h3 className="text-slate-300 font-medium text-sm mb-2">
                Composição de Gastos
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
        </div>
      )}

      {/* VISTA DE EXTRATO (Mantida inalterada da versão anterior) */}
      {activeTab === "extrato" && (
        <div className="bg-[#111827] rounded-xl border border-slate-800 overflow-hidden shadow-lg animate-fade-in">
          <div className="p-4 border-b border-slate-800 bg-[#0f172a] flex justify-between items-center">
            <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
              Base de Dados Bruta
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
