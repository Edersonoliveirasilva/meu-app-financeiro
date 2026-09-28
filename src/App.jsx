import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db'; // O seu ficheiro da base de dados local
import { Wallet, Clock, ArrowUpCircle, ArrowDownCircle, Plus, Fingerprint, Lock, Download, Printer, RefreshCw, Trash2, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { subDays, subMonths, subYears } from 'date-fns';
import { PluggyConnect } from 'react-pluggy-connect'; // Ajuste se a sua importação da Pluggy for diferente

const CATEGORIES = ['Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Saúde', 'Educação', 'Compras', 'Salário', 'Geral'];
const COLORS = ['#2ed573', '#ff4757', '#ffa502', '#1e90ff', '#a4b0be', '#ff7f50', '#7bed9f', '#70a1ff'];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  
  // --- ESTADOS DO DASHBOARD E FILTROS ---
  const [viewMode, setViewMode] = useState('list'); // 'list' ou 'dashboard'
  const [filterType, setFilterType] = useState('all'); // 'all', 'income', 'expense'
  const [filterCategory, setFilterCategory] = useState('all');
  const [reportPeriod, setReportPeriod] = useState('Mensal'); // 'Tudo', 'Semanal', 'Quinzenal', 'Mensal', 'Anual'
  
  // --- ESTADO DO FORMULÁRIO E PLUGGY ---
  const [form, setForm] = useState({ type: 'expense', amount: '', description: '', category: 'Geral' });
  const [pluggyToken, setPluggyToken] = useState('');

  // Vai buscar os dados à base de dados local
  const transactions = useLiveQuery(() => db.transactions.orderBy('timestamp').reverse().toArray(), []) || [];

  // --- LÓGICA DE FILTRAGEM ---
  const filteredTransactions = transactions.filter(t => {
    // 1. Filtro de Tipo
    if (filterType !== 'all' && t.type !== filterType) return false;
    
    // 2. Filtro de Categoria
    if (filterCategory !== 'all' && t.category !== filterCategory) return false;
    
    // 3. Filtro de Data (Período)
    const txDate = new Date(t.date);
    const now = new Date();
    if (reportPeriod === 'Semanal' && txDate < subDays(now, 7)) return false;
    if (reportPeriod === 'Quinzenal' && txDate < subDays(now, 15)) return false;
    if (reportPeriod === 'Mensal' && txDate < subMonths(now, 1)) return false;
    if (reportPeriod === 'Anual' && txDate < subYears(now, 1)) return false;

    return true;
  });

  // --- CÁLCULOS TOTAIS (Baseados nos Filtros Ativos) ---
  const totalIncome = filteredTransactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = filteredTransactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
  const balance = totalIncome - totalExpense;

  // --- PREPARAÇÃO DE DADOS PARA OS GRÁFICOS ---
  const expensesByCategory = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, {});

  const pieChartData = Object.keys(expensesByCategory)
    .map(key => ({ name: key, value: expensesByCategory[key] }))
    .sort((a, b) => b.value - a.value); // Ordena do maior para o menor gasto

  const barChartData = [
    { name: 'Entradas', valor: totalIncome, fill: '#2ed573' },
    { name: 'Saídas', valor: totalExpense, fill: '#ff4757' }
  ];

  // --- FUNÇÕES DE AÇÃO ---
  const handleUnlock = async () => {
    setIsAuthenticated(true);
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    setIsGettingLocation(true);
    const now = new Date();
    
    await db.transactions.add({
      ...form,
      amount: parseFloat(form.amount),
      date: now.toISOString(),
      timestamp: now.getTime(),
      timeString: now.toLocaleTimeString()
    });
    
    setForm({ type: 'expense', amount: '', description: '', category: 'Geral' });
    setShowForm(false);
    setIsGettingLocation(false);
  };

  const deleteTransaction = async (id) => {
    await db.transactions.delete(id);
  };

  const handleConnectBank = async () => {
    try {
      const response = await fetch('https://nexus-backend-fv9d.onrender.com/api/token');
      if (!response.ok) throw new Error("Erro no servidor");
      const data = await response.json();
      setPluggyToken(data.accessToken);
    } catch (error) {
      alert("ERRO: Não foi possível ligar ao servidor Render.");
    }
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredTransactions.map(t => ({
      Data: new Date(t.date).toLocaleDateString(),
      Hora: t.timeString,
      Tipo: t.type === 'income' ? 'Entrada' : 'Saída',
      Categoria: t.category,
      Valor: t.amount,
      Descrição: t.description
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, `NexusFin_${reportPeriod}.xlsx`);
  };

  const printReport = () => {
    window.print();
  };

  // --- ECRÃ DE BLOQUEIO ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0f111a] flex flex-col items-center justify-center text-white p-6">
        <Lock className="w-16 h-16 text-slate-500 mb-6 animate-pulse" />
        <h1 className="text-3xl font-bold mb-2">NexusFin</h1>
        <p className="text-gray-400 mb-12">Seu patrimônio, sob controle.</p>
        <button onClick={handleUnlock} className="flex flex-col items-center gap-4 text-neonGreen hover:text-emerald-400 transition cursor-pointer">
          <Fingerprint className="w-20 h-20" />
          <span className="font-medium text-lg">Tocar para Entrar</span>
        </button>
      </div>
    );
  }

  // --- APLICAÇÃO PRINCIPAL ---
  return (
    <div className="min-h-screen bg-[#0f111a] text-white font-sans p-4 sm:p-6 pb-24">
      <div className="max-w-4xl mx-auto">
        
        {/* CABEÇALHO (Agora com botões de Imprimir e Conectar Maior) */}
        <header className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-neonGreen tracking-wider">
            <Wallet className="w-8 h-8" /> NEXUSFIN
          </h1>
          <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
            <button onClick={exportToExcel} className="p-3 bg-gray-800 rounded-xl text-gray-300 hover:text-neonGreen transition" title="Exportar Excel">
              <Download className="w-5 h-5" />
            </button>
            <button onClick={printReport} className="p-3 bg-gray-800 rounded-xl text-gray-300 hover:text-neonGreen transition" title="Imprimir Relatório (PDF)">
              <Printer className="w-5 h-5" />
            </button>
            <button onClick={handleConnectBank} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-neonGreen text-[#0f111a] px-6 py-3 rounded-xl font-bold hover:bg-emerald-400 transition shadow-[0_0_15px_rgba(46,213,115,0.3)] whitespace-nowrap">
              <RefreshCw className="w-5 h-5" />
              Conectar ao Banco
            </button>
          </div>
        </header>

        {/* CARTÃO DE SALDO */}
        <section className="bg-gray-800/40 border border-gray-700/50 rounded-3xl p-6 sm:p-8 mb-8 backdrop-blur-sm shadow-xl">
          <p className="text-gray-400 text-center mb-2">Saldo Atual</p>
          <h2 className={`text-4xl sm:text-5xl font-bold text-center mb-8 ${balance >= 0 ? 'text-white' : 'text-red-400'}`}>
            R$ {balance.toFixed(2)}
          </h2>
          <div className="flex justify-between border-t border-gray-700/50 pt-6">
            <div>
              <p className="text-gray-400 text-sm flex items-center gap-1 mb-1"><ArrowUpCircle className="w-4 h-4 text-neonGreen" /> Entradas</p>
              <p className="text-neonGreen font-bold text-lg">R$ {totalIncome.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-sm flex items-center justify-end gap-1 mb-1"><ArrowDownCircle className="w-4 h-4 text-red-400" /> Saídas</p>
              <p className="text-red-400 font-bold text-lg">R$ {totalExpense.toFixed(2)}</p>
            </div>
          </div>
        </section>

        {/* MENUS DE CONTROLO E FILTROS */}
        <section className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
            
            {/* Alternar Vista */}
            <div className="flex bg-gray-900 rounded-full p-1 border border-gray-800 w-full sm:w-auto">
              <button onClick={() => setViewMode('list')} className={`flex-1 sm:flex-none px-6 py-2 rounded-full font-medium transition ${viewMode === 'list' ? 'bg-neonGreen text-[#0f111a]' : 'text-gray-400 hover:text-white'}`}>
                Extrato
              </button>
              <button onClick={() => setViewMode('dashboard')} className={`flex-1 sm:flex-none px-6 py-2 rounded-full font-medium transition ${viewMode === 'dashboard' ? 'bg-neonGreen text-[#0f111a]' : 'text-gray-400 hover:text-white'}`}>
                Dashboard
              </button>
            </div>

            {/* Filtros de Tempo e Tipo */}
            <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-center">
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:ring-neonGreen focus:border-neonGreen block p-2.5">
                <option value="all">Todas as Operações</option>
                <option value="income">Só Entradas</option>
                <option value="expense">Só Saídas</option>
              </select>
              
              <select value={reportPeriod} onChange={(e) => setReportPeriod(e.target.value)} className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:ring-neonGreen focus:border-neonGreen block p-2.5">
                <option value="Tudo">Desde o Início</option>
                <option value="Semanal">Últimos 7 dias</option>
                <option value="Quinzenal">Últimos 15 dias</option>
                <option value="Mensal">Últimos 30 dias</option>
                <option value="Anual">Este Ano</option>
              </select>
            </div>
          </div>
        </section>

        {/* ÁREA DINÂMICA: LISTA OU DASHBOARD */}
        {viewMode === 'list' ? (
          <section className="space-y-4">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-200">
              <Clock className="w-5 h-5 text-neonGreen"/> Transações {reportPeriod !== 'Tudo' && <span className="text-sm font-normal text-gray-400">({reportPeriod})</span>}
            </h3>
            {filteredTransactions.length === 0 ? (
              <p className="text-center text-gray-500 py-10">Nenhum registo encontrado para estes filtros.</p>
            ) : (
              filteredTransactions.map(t => (
                <div key={t.id} className="bg-gray-800/30 border border-gray-700/50 p-4 rounded-2xl flex justify-between items-center hover:bg-gray-800/60 transition">
                  <div>
                    <p className="font-bold text-gray-200 uppercase">{t.description}</p>
                    <p className="text-xs text-gray-500 mt-1">{t.category} • {new Date(t.date).toLocaleDateString()} às {t.timeString}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className={`font-bold ${t.type === 'income' ? 'text-neonGreen' : 'text-red-400'}`}>
                      {t.type === 'income' ? '+' : '-'} R$ {t.amount.toFixed(2)}
                    </p>
                    <button onClick={() => deleteTransaction(t.id)} className="text-gray-600 hover:text-red-500 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>
        ) : (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
            {/* Gráfico Circular de Categorias */}
            <div className="bg-gray-800/30 border border-gray-700/50 p-6 rounded-3xl">
              <h3 className="text-lg font-bold mb-6 text-center text-gray-200">Despesas por Categoria</h3>
              <div className="h-64">
                {pieChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={5} dataKey="value">
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value) => `R$ ${value.toFixed(2)}`} contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff', borderRadius: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-500">Sem despesas neste período</div>
                )}
              </div>
            </div>

            {/* Ranking de Categorias em Lista */}
            <div className="bg-gray-800/30 border border-gray-700/50 p-6 rounded-3xl">
              <h3 className="text-lg font-bold mb-6 text-gray-200">Top Gastos</h3>
              <div className="space-y-4">
                {pieChartData.length > 0 ? pieChartData.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                      <span className="text-gray-300 font-medium">{item.name}</span>
                    </div>
                    <span className="font-bold text-red-400">R$ {item.value.toFixed(2)}</span>
                  </div>
                )) : (
                  <p className="text-gray-500 text-center">Nenhum dado.</p>
                )}
              </div>
            </div>
            
            {/* Gráfico de Barras (Receita vs Despesa) */}
            <div className="bg-gray-800/30 border border-gray-700/50 p-6 rounded-3xl lg:col-span-2">
              <h3 className="text-lg font-bold mb-6 text-center text-gray-200">Balanço Geral</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <XAxis dataKey="name" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" tickFormatter={(value) => `R$${value}`} />
                    <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff', borderRadius: '8px' }} formatter={(value) => `R$ ${value.toFixed(2)}`} />
                    <Bar dataKey="valor" radius={[8, 8, 0, 0]}>
                      {barChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        )}

      </div>

      {/* COMPONENTE DE LIGAÇÃO BANCÁRIA PLUGGY */}
      {pluggyToken && (
        <PluggyConnect
          connectToken={pluggyToken}
          includesSandbox={false} // <--- AQUI: AGORA USA CONTAS REAIS!
          onSucess={async (itemData) => {
            try {
              const response = await fetch(`https://nexus-backend-fv9d.onrender.com/api/transactions/${itemData.item.id}`);
              if (!response.ok) throw new Error();
              const data = await response.json();
              data.results.forEach(async (tx) => {
                await db.transactions.add({
                  type: tx.amount > 0 ? 'income' : 'expense',
                  amount: Math.abs(tx.amount),
                  description: tx.description,
                  category: tx.category || 'Banco',
                  date: new Date(tx.date).toISOString(),
                  timeString: 'Importado',
                  timestamp: new Date(tx.date).getTime()
                });
              });
              setPluggyToken('');
            } catch(e) {
              alert("Erro a importar dados.");
              setPluggyToken('');
            }
          }}
          onError={() => setPluggyToken('')}
          onClose={() => setPluggyToken('')}
        />
      )}

      {/* BOTÃO FLUTUANTE (ADICIONAR) */}
      <button 
        onClick={() => setShowForm(true)} 
        className="fixed bottom-6 right-6 bg-neonGreen text-[#0f111a] p-4 rounded-full shadow-[0_0_20px_rgba(46,213,115,0.4)] hover:scale-110 transition z-40"
      >
        <Plus className="w-8 h-8" />
      </button>

      {/* MODAL DE NOVO LANÇAMENTO (COM CATEGORIAS) */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 w-full max-w-md rounded-3xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2"><Plus className="text-neonGreen"/> Novo Lançamento</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white text-2xl cursor-pointer">&times;</button>
            </div>
            
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div className="flex bg-gray-800 rounded-xl p-1 border border-gray-700">
                <div className={`flex-1 py-2 text-center cursor-pointer font-bold rounded-lg transition ${form.type === 'expense' ? 'bg-red-500 text-white' : 'text-gray-400'}`} onClick={() => setForm({...form, type: 'expense'})}>SAÍDA</div>
                <div className={`flex-1 py-2 text-center cursor-pointer font-bold rounded-lg transition ${form.type === 'income' ? 'bg-neonGreen text-[#0f111a]' : 'text-gray-400'}`} onClick={() => setForm({...form, type: 'income'})}>ENTRADA</div>
              </div>
              
              <input type="number" step="0.01" required placeholder="0.00" className="w-full bg-gray-800 border-none text-white p-4 rounded-xl text-2xl text-center focus:ring-2 focus:ring-neonGreen" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
              <input type="text" required placeholder="Descrição (ex: Supermercado)" className="w-full bg-gray-800 border border-gray-700 text-white p-3 rounded-xl focus:ring-2 focus:ring-neonGreen" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full bg-gray-800 border border-gray-700 text-white p-3 rounded-xl focus:ring-2 focus:ring-neonGreen">
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <button type="submit" className="w-full bg-neonGreen text-[#0f111a] p-4 rounded-xl font-bold text-lg hover:bg-emerald-400 transition mt-4">
                Gravar Lançamento
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}