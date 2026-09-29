import React, { useState, useEffect, useMemo } from 'react';
import Dexie from 'dexie';
import { PluggyConnect } from 'react-pluggy-connect';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, 
  AreaChart, Area 
} from 'recharts';

// Inicialização da Base de Dados Local
const db = new Dexie('NexusFinDB_Pro');
db.version(1).stores({
  transactions: '++id, type, amount, description, category, date, timeString, timestamp'
});

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [pluggyToken, setPluggyToken] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Filtros
  const [filterType, setFilterType] = useState('Todas as Operações');
  const [filterDate, setFilterDate] = useState('Desde o Início');
  const [filterCategory, setFilterCategory] = useState('Todas');

  // Cores BI (Baseadas nas suas referências escurecidas)
  const COLORS_EXPENSE = ['#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#14B8A6', '#06B6D4', '#6366F1', '#A855F7', '#EC4899'];
  const COLORS_INCOME = ['#10B981', '#34D399', '#059669', '#047857', '#065F46'];

  const loadData = async () => {
    const allTx = await db.transactions.toArray();
    allTx.sort((a, b) => b.timestamp - a.timestamp);
    setTransactions(allTx);
  };

  useEffect(() => { loadData(); }, []);

  // --------------------------------------------------------
  // MOTOR DE AUTO-CATEGORIZAÇÃO INTELIGENTE
  // --------------------------------------------------------
  const autoCategorize = (desc, amount) => {
    const d = desc.toLowerCase();
    
    // Categorias de ENTRADA (Dinheiro positivo)
    if (amount > 0) {
      if (d.includes('salário') || d.includes('pagamento') || d.includes('ordenado')) return 'Salário';
      if (d.includes('rendimento') || d.includes('juros') || d.includes('investimento')) return 'Rendimentos';
      if (d.includes('pix')) return 'PIX Recebido';
      if (d.includes('estorno') || d.includes('reembolso')) return 'Reembolsos';
      return 'Outras Receitas';
    }
    
    // Categorias de SAÍDA (Dinheiro negativo)
    if (d.includes('mercado') || d.includes('supermercado') || d.includes('ifood') || d.includes('restaurante') || d.includes('padaria') || d.includes('assai') || d.includes('atacadao')) return 'Alimentação';
    if (d.includes('posto') || d.includes('uber') || d.includes('99') || d.includes('gasolina') || d.includes('estacionamento') || d.includes('pedágio')) return 'Transporte';
    if (d.includes('vivo') || d.includes('claro') || d.includes('tim') || d.includes('internet') || d.includes('telefone') || d.includes('netflix') || d.includes('spotify')) return 'Assinaturas/Telefonia';
    if (d.includes('energia') || d.includes('água') || d.includes('luz') || d.includes('condomínio') || d.includes('iptu') || d.includes('cpfl') || d.includes('sabesp')) return 'Contas Casa';
    if (d.includes('pix')) return 'PIX Enviado';
    if (d.includes('fatura') || d.includes('cartão') || d.includes('nubank')) return 'Cartão de Crédito';
    if (d.includes('farmácia') || d.includes('drogaria') || d.includes('saúde') || d.includes('unimed')) return 'Saúde';
    if (d.includes('imposto') || d.includes('taxa') || d.includes('tarifa') || d.includes('iof')) return 'Taxas/Impostos';
    
    return 'Outros Gastos';
  };

  const handleImportCSV = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim() !== '');
        const newTransactions = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',');
          if (cols.length >= 3) {
            const dataStr = cols[0].trim(); 
            const valor = parseFloat(cols[1]); 
            const descricao = cols[cols.length - 1].replace(/"/g, '').trim(); 

            if (isNaN(valor)) continue;

            let [dia, mes, ano] = dataStr.split('/');
            if (dia.length === 4) [ano, mes, dia] = dataStr.split('-'); 
            const txDate = new Date(ano, mes - 1, dia);

            // Aplica a inteligência de categorização
            const categoriaInteligente = autoCategorize(descricao, valor);

            newTransactions.push({
              type: valor < 0 ? 'expense' : 'income',
              amount: Math.abs(valor),
              description: descricao,
              category: categoriaInteligente,
              date: txDate.toISOString(),
              timeString: 'Via CSV',
              timestamp: txDate.getTime()
            });
          }
        }

        await db.transactions.bulkAdd(newTransactions);
        alert(`Sucesso! ${newTransactions.length} transações importadas e categorizadas.`);
        event.target.value = '';
        loadData(); 
      } catch (error) {
        console.error("Erro CSV:", error);
        alert("Ocorreu um erro. Verifique o ficheiro CSV.");
      }
    };
    reader.readAsText(file);
  };

  const uniqueCategories = useMemo(() => ['Todas', ...new Set(transactions.map(t => t.category))], [transactions]);

  // Lógica de Filtros
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;
    const agora = new Date().getTime();
    const hoje = new Date();

    if (filterType === 'Entradas') filtered = filtered.filter(t => t.type === 'income');
    if (filterType === 'Saídas') filtered = filtered.filter(t => t.type === 'expense');
    if (filterCategory !== 'Todas') filtered = filtered.filter(t => t.category === filterCategory);

    if (filterDate === 'Últimos 7 dias') filtered = filtered.filter(t => t.timestamp >= agora - (7 * 86400000));
    else if (filterDate === 'Últimos 30 dias') filtered = filtered.filter(t => t.timestamp >= agora - (30 * 86400000));
    else if (filterDate === 'Últimos 90 dias') filtered = filtered.filter(t => t.timestamp >= agora - (90 * 86400000));
    else if (filterDate === 'Este Mês') filtered = filtered.filter(t => new Date(t.timestamp).getMonth() === hoje.getMonth() && new Date(t.timestamp).getFullYear() === hoje.getFullYear());
    else if (filterDate === 'Este Ano') filtered = filtered.filter(t => new Date(t.timestamp).getFullYear() === hoje.getFullYear());

    return filtered.sort((a, b) => a.timestamp - b.timestamp); // Ordena cronologicamente para os gráficos
  }, [transactions, filterType, filterDate, filterCategory]);

  // KPIs
  const { entradas, saidas } = filteredTransactions.reduce((acc, cur) => {
    if (cur.type === 'income') acc.entradas += cur.amount;
    else acc.saidas += cur.amount;
    return acc;
  }, { entradas: 0, saidas: 0 });
  const saldoAtual = entradas - saidas;
  const margem = entradas > 0 ? ((saldoAtual / entradas) * 100).toFixed(1) : 0;

  // Prepara Dados para o Gráfico de Área (Evolução no Tempo)
  const evolutionData = useMemo(() => {
    const dailyMap = {};
    filteredTransactions.forEach(tx => {
      const dateStr = new Date(tx.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      if (!dailyMap[dateStr]) dailyMap[dateStr] = { name: dateStr, Receitas: 0, Despesas: 0 };
      if (tx.type === 'income') dailyMap[dateStr].Receitas += tx.amount;
      else dailyMap[dateStr].Despesas += tx.amount;
    });
    return Object.values(dailyMap);
  }, [filteredTransactions]);

  // Prepara Dados para Gráficos de Categoria (Rosca)
  const expenseCategories = useMemo(() => {
    const data = {};
    filteredTransactions.filter(t => t.type === 'expense').forEach(tx => data[tx.category] = (data[tx.category] || 0) + tx.amount);
    return Object.keys(data).map(k => ({ name: k, value: data[k] })).sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  const incomeCategories = useMemo(() => {
    const data = {};
    filteredTransactions.filter(t => t.type === 'income').forEach(tx => data[tx.category] = (data[tx.category] || 0) + tx.amount);
    return Object.keys(data).map(k => ({ name: k, value: data[k] })).sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-200 p-4 md:p-6 font-sans selection:bg-indigo-500/30">
      
      {/* CABEÇALHO EXECUTIVO */}
      <header className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Painel Financeiro BI</h1>
            <p className="text-xs text-slate-400">Análise de Receita e Margem</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <label className="cursor-pointer bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Importar CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
          </label>
        </div>
      </header>

      {/* BARRA DE FERRAMENTAS E FILTROS */}
      <div className="flex flex-col lg:flex-row justify-between items-center bg-[#111827] p-3 rounded-lg border border-slate-800 mb-6 gap-4 shadow-sm">
        <div className="flex bg-[#0f172a] rounded p-1 w-full lg:w-auto border border-slate-800">
          <button onClick={() => setActiveTab('dashboard')} className={`flex-1 px-5 py-1.5 rounded text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Painel BI</button>
          <button onClick={() => setActiveTab('extrato')} className={`flex-1 px-5 py-1.5 rounded text-sm font-medium transition-all ${activeTab === 'extrato' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Base de Dados (Extrato)</button>
        </div>

        <div className="flex flex-wrap lg:flex-nowrap gap-2 w-full lg:w-auto">
          <select value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="bg-[#0f172a] border border-slate-700 rounded p-2 text-sm text-slate-300 focus:border-indigo-500 outline-none flex-1">
            <option>Últimos 30 dias</option>
            <option>Últimos 90 dias</option>
            <option>Este Mês</option>
            <option>Este Ano</option>
            <option>Desde o Início</option>
          </select>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="bg-[#0f172a] border border-slate-700 rounded p-2 text-sm text-slate-300 focus:border-indigo-500 outline-none flex-1">
            {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
      </div>

      {activeTab === 'dashboard' && (
        <div className="animate-fade-in space-y-6">
          
          {/* CARDS DE KPI (Estilo Fabridata / Power BI) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-indigo-900/40 to-[#111827] p-5 rounded-xl border border-indigo-500/20 shadow-lg">
              <p className="text-slate-400 text-xs font-semibold uppercase mb-1">Receita Operacional</p>
              <h2 className="text-3xl font-bold text-indigo-400">R$ {entradas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h2>
            </div>
            <div className="bg-gradient-to-br from-rose-900/40 to-[#111827] p-5 rounded-xl border border-rose-500/20 shadow-lg">
              <p className="text-slate-400 text-xs font-semibold uppercase mb-1">Despesas / Custos</p>
              <h2 className="text-3xl font-bold text-rose-400">R$ {saidas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h2>
            </div>
            <div className="bg-gradient-to-br from-emerald-900/40 to-[#111827] p-5 rounded-xl border border-emerald-500/20 shadow-lg">
              <p className="text-slate-400 text-xs font-semibold uppercase mb-1">Margem / Saldo</p>
              <h2 className="text-3xl font-bold text-emerald-400">R$ {saldoAtual.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h2>
            </div>
            <div className="bg-[#111827] p-5 rounded-xl border border-slate-800 shadow-lg flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs font-semibold uppercase mb-1">% Saúde Financeira</p>
                <h2 className="text-3xl font-bold text-slate-100">{margem}%</h2>
              </div>
              <div className="w-12 h-12 rounded-full border-4 flex items-center justify-center border-slate-700 border-t-indigo-500 transform rotate-45"></div>
            </div>
          </div>

          {/* ÁREA DE GRÁFICOS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Gráfico Principal: Evolução no Tempo */}
            <div className="col-span-1 lg:col-span-2 bg-[#111827] p-5 rounded-xl border border-slate-800 shadow-lg h-96">
              <h3 className="text-slate-300 font-medium text-sm mb-4">Evolução Mensal: Despesas vs Receitas</h3>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolutionData}>
                  <defs>
                    <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorDesp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fb7185" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#fb7185" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} tickLine={false} axisLine={false} tickFormatter={(val) => `R$${val/1000}k`} />
                  <RechartsTooltip cursor={{stroke: '#334155', strokeWidth: 1, strokeDasharray: '5 5'}} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', color: '#f1f5f9' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  <Area type="monotone" dataKey="Receitas" stroke="#818cf8" strokeWidth={3} fillOpacity={1} fill="url(#colorRec)" />
                  <Area type="monotone" dataKey="Despesas" stroke="#fb7185" strokeWidth={3} fillOpacity={1} fill="url(#colorDesp)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Gráfico Rosca: Top 5 Despesas por Categoria */}
            <div className="col-span-1 bg-[#111827] p-5 rounded-xl border border-slate-800 shadow-lg h-96 flex flex-col">
              <h3 className="text-slate-300 font-medium text-sm mb-2">Despesas por Categoria</h3>
              {expenseCategories.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expenseCategories} cx="50%" cy="45%" innerRadius={70} outerRadius={100} paddingAngle={3} dataKey="value" stroke="none">
                      {expenseCategories.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS_EXPENSE[index % COLORS_EXPENSE.length]} />)}
                    </Pie>
                    <RechartsTooltip formatter={(val) => `R$ ${val.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} />
                    <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">Sem dados de saída.</div>
              )}
            </div>
          </div>

          {/* TABELA DE AUDITORIA: Maiores Gastos do Período */}
          <div className="bg-[#111827] rounded-xl border border-slate-800 shadow-lg p-5">
            <h3 className="text-slate-300 font-medium text-sm mb-4">Top 10 Maiores Transações do Período</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-[#0f172a] text-slate-400 text-xs uppercase font-medium">
                  <tr>
                    <th className="px-4 py-3 rounded-l-md">Data</th>
                    <th className="px-4 py-3">Descrição (Fornecedor)</th>
                    <th className="px-4 py-3">Categoria</th>
                    <th className="px-4 py-3 text-right rounded-r-md">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {/* Pega as top 10 maiores transações independente de entrada ou saída para auditar */}
                  {[...filteredTransactions].sort((a,b) => b.amount - a.amount).slice(0, 10).map((tx, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-400">{new Date(tx.timestamp).toLocaleDateString('pt-BR')}</td>
                      <td className="px-4 py-3 font-medium text-slate-200">{tx.description}</td>
                      <td className="px-4 py-3">
                        <span className="bg-slate-800 px-2.5 py-1 rounded-full text-xs border border-slate-700">{tx.category}</span>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${tx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {tx.type === 'income' ? '+' : '-'} R$ {tx.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VISTA DE EXTRATO (BASE DE DADOS COMPLETA) */}
      {activeTab === 'extrato' && (
         <div className="bg-[#111827] rounded-xl border border-slate-800 overflow-hidden shadow-lg animate-fade-in">
           <div className="p-4 border-b border-slate-800 bg-[#0f172a] flex justify-between items-center">
             <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Base de Dados Auditável</h2>
             <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs px-3 py-1 rounded-full font-medium">{filteredTransactions.length} registros</span>
           </div>
           
           <div className="divide-y divide-slate-800/50 max-h-[70vh] overflow-y-auto">
             {filteredTransactions.map((tx) => (
               <div key={tx.id} className="p-3 px-5 hover:bg-slate-800/50 flex flex-col sm:flex-row sm:justify-between sm:items-center transition-colors group">
                 <div className="flex items-center gap-4">
                   <div className={`w-2 h-2 rounded-full ${tx.type === 'income' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`}></div>
                   <div>
                     <p className="text-slate-200 font-medium text-sm">{tx.description}</p>
                     <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                       <span>{new Date(tx.timestamp).toLocaleDateString('pt-BR')}</span>
                       <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                       <span>{tx.category}</span>
                     </p>
                   </div>
                 </div>
                 <div className={`font-medium text-sm text-right mt-2 sm:mt-0 ${tx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                   {tx.type === 'income' ? '+' : '-'} R$ {tx.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                 </div>
               </div>
             ))}
           </div>
         </div>
      )}
    </div>
  );
}