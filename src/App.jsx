import React, { useState, useEffect, useMemo } from 'react';
import Dexie from 'dexie';
import { PluggyConnect } from 'react-pluggy-connect';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, 
  XAxis, YAxis, CartesianGrid, Legend, AreaChart, Area 
} from 'recharts';

// Base de Dados Local
const db = new Dexie('NexusFinDB_Pro');
db.version(2).stores({
  transactions: '++id, type, amount, description, category, date, timeString, timestamp',
  customRules: '++id, keyword, newCategory'
});

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [customRules, setCustomRules] = useState([]);
  const [pluggyToken, setPluggyToken] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showValues, setShowValues] = useState(true);
  
  // MODO CLARO / ESCURO
  const [theme, setTheme] = useState('dark');
  
  // Modal de Edição
  const [editingTx, setEditingTx] = useState(null);
  const [editCategory, setEditCategory] = useState('');
  const [editKeyword, setEditKeyword] = useState('');
  const [saveAsRule, setSaveAsRule] = useState(true);
  
  const [filterDate, setFilterDate] = useState('Este Mês');
  const [filterCategory, setFilterCategory] = useState('Todas');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const COLORS_EXPENSE = ['#e11d48', '#f43f5e', '#fb923c', '#f59e0b', '#84cc16', '#14b8a6', '#06b6d4', '#6366f1', '#a855f7', '#ec4899'];

  // Classes Dinâmicas de Tema
  const s = {
    bgApp: theme === 'dark' ? 'bg-[#0b1120]' : 'bg-slate-50',
    textMain: theme === 'dark' ? 'text-slate-200' : 'text-slate-800',
    bgCard: theme === 'dark' ? 'bg-[#111827]' : 'bg-white',
    borderCard: theme === 'dark' ? 'border-slate-800' : 'border-slate-200',
    bgInput: theme === 'dark' ? 'bg-[#0f172a]' : 'bg-slate-100',
    borderInput: theme === 'dark' ? 'border-slate-700' : 'border-slate-300',
    textMuted: theme === 'dark' ? 'text-slate-400' : 'text-slate-500',
    bgHover: theme === 'dark' ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50',
    chartText: theme === 'dark' ? '#64748b' : '#94a3b8',
    chartGrid: theme === 'dark' ? '#1e293b' : '#e2e8f0',
  };

  const loadData = async () => {
    const allTx = await db.transactions.toArray();
    const rules = await db.customRules.toArray();
    allTx.sort((a, b) => b.timestamp - a.timestamp);
    setTransactions(allTx);
    setCustomRules(rules);
  };

  useEffect(() => { 
    loadData(); 
    const onFocus = () => loadData();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const formatMoney = (value) => {
    if (!showValues) return '••••••';
    return value.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  };

  const autoCategorize = (desc, amount, currentRules = customRules) => {
    const d = desc.toLowerCase();
    for (let rule of currentRules) {
      if (d.includes(rule.keyword.toLowerCase())) return rule.newCategory;
    }
    if (amount > 0) {
      if (d.includes('salário') || d.includes('pagamento') || d.includes('ordenado')) return 'Salário';
      if (d.includes('rendimento') || d.includes('juros')) return 'Rendimentos';
      if (d.includes('pix')) return 'PIX Recebido';
      return 'Outras Receitas';
    }
    if (d.includes('mercado') || d.includes('supermercado') || d.includes('ifood') || d.includes('restaurante') || d.includes('padaria')) return 'Alimentação';
    if (d.includes('posto') || d.includes('uber') || d.includes('99') || d.includes('gasolina') || d.includes('combustível')) return 'Transporte';
    if (d.includes('vivo') || d.includes('claro') || d.includes('tim') || d.includes('internet') || d.includes('telefone') || d.includes('netflix')) return 'Assinaturas';
    if (d.includes('energia') || d.includes('água') || d.includes('luz') || d.includes('condomínio') || d.includes('iptu')) return 'Contas Casa';
    if (d.includes('pix')) return 'PIX Enviado';
    if (d.includes('fatura') || d.includes('cartão') || d.includes('nubank')) return 'Cartão de Crédito';
    if (d.includes('farmácia') || d.includes('drogaria') || d.includes('saúde') || d.includes('unimed')) return 'Saúde';
    return 'Outros Gastos';
  };

  const saveCategoryEdit = async () => {
    if (!editCategory.trim()) return;
    try {
      if (saveAsRule && editKeyword.trim()) {
        const ruleKeyword = editKeyword.trim().toLowerCase();
        await db.customRules.add({ keyword: ruleKeyword, newCategory: editCategory });
        const allTx = await db.transactions.toArray();
        const updates = allTx.filter(t => t.description.toLowerCase().includes(ruleKeyword));
        for (let tx of updates) await db.transactions.update(tx.id, { category: editCategory });
        alert(`O NexusFin aprendeu! ${updates.length} transação(ões) atualizada(s).`);
      } else {
        await db.transactions.update(editingTx.id, { category: editCategory });
      }
      setEditingTx(null);
      loadData();
    } catch (error) {
      alert("Erro ao editar a categoria.");
    }
  };

  const openEditModal = (tx) => {
    setEditingTx(tx);
    setEditCategory(tx.category !== 'Outros Gastos' ? tx.category : '');
    const parts = tx.description.split('|');
    setEditKeyword(parts.length > 1 ? parts[parts.length - 1].trim() : tx.description);
  };

  const handleImportCSV = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const lines = e.target.result.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) return;
        const newTransactions = [];
        const isBancoDoBrasil = lines[0].includes('Tipo Lançamento') || lines[0].includes('Lançamento');
        const separator = lines[0].includes(';') ? ';' : ',';
        const currentRules = await db.customRules.toArray();

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          const regex = new RegExp(`${separator}(?=(?:(?:[^"]*"){2})*[^"]*$)`);
          const cols = line.split(regex).map(col => col.replace(/(^"|"$)/g, '').trim());
          if (cols.length < 3) continue;

          let dataStr, valorStr, descricao;
          if (isBancoDoBrasil) {
            if (cols[1].includes('Saldo Anterior') || cols[1].includes('Saldo do dia')) continue; 
            dataStr = cols[0];
            descricao = cols[2] !== '' ? `${cols[1]} - ${cols[2]}` : cols[1];
            valorStr = cols[4];
          } else {
            dataStr = cols[0];
            valorStr = cols[1];
            descricao = cols[cols.length - 1];
          }
          if (!valorStr) continue;

          let valorTratado = valorStr.includes(',') ? valorStr.replace(/\./g, '').replace(',', '.') : valorStr;
          const valor = parseFloat(valorTratado);
          if (isNaN(valor) || valor === 0) continue;

          let dia, mes, ano;
          if (dataStr.includes('/')) [dia, mes, ano] = dataStr.split('/');
          else if (dataStr.includes('-')) [ano, mes, dia] = dataStr.split('-');
          if (!ano || !mes || !dia) continue;

          newTransactions.push({
            type: valor < 0 ? 'expense' : 'income',
            amount: Math.abs(valor),
            description: descricao,
            category: autoCategorize(descricao, valor, currentRules),
            date: new Date(ano, mes - 1, dia).toISOString(),
            timeString: isBancoDoBrasil ? 'CSV BB' : 'CSV Padrão',
            timestamp: new Date(ano, mes - 1, dia).getTime()
          });
        }
        await db.transactions.bulkAdd(newTransactions);
        alert(`Sucesso! ${newTransactions.length} transações importadas.`);
        event.target.value = '';
        loadData(); 
      } catch (error) { alert("Erro ao importar CSV."); }
    };
    reader.readAsText(file, 'windows-1252');
  };

  const handleClearDatabase = async () => {
    if (window.confirm("Isto apagará também as regras de inteligência criadas. Tem a certeza?")) {
      await db.transactions.clear();
      await db.customRules.clear();
      setTransactions([]);
      setCustomRules([]);
    }
  };

  const requestPluggyToken = async () => {
    try {
      const response = await fetch('https://nexus-backend-fv9d.onrender.com/api/token');
      if (!response.ok) throw new Error('Falha ao obter token');
      const data = await response.json();
      setPluggyToken(data.accessToken);
    } catch (error) { alert("ERRO: Falha ao ligar ao servidor."); }
  };

  const uniqueCategories = useMemo(() => ['Todas', ...new Set(transactions.map(t => t.category))], [transactions]);

  const filteredTransactions = useMemo(() => {
    let filtered = transactions;
    const agora = new Date().getTime();
    const hoje = new Date();

    if (filterCategory !== 'Todas') filtered = filtered.filter(t => t.category === filterCategory);

    if (filterDate === 'Personalizado') {
      if (startDate) filtered = filtered.filter(t => t.timestamp >= new Date(startDate + 'T00:00:00').getTime());
      if (endDate) filtered = filtered.filter(t => t.timestamp <= new Date(endDate + 'T23:59:59').getTime());
    } else {
      if (filterDate === 'Últimos 15 dias') filtered = filtered.filter(t => t.timestamp >= agora - (15 * 86400000));
      else if (filterDate === 'Últimos 30 dias') filtered = filtered.filter(t => t.timestamp >= agora - (30 * 86400000));
      else if (filterDate === 'Este Mês') filtered = filtered.filter(t => new Date(t.timestamp).getMonth() === hoje.getMonth() && new Date(t.timestamp).getFullYear() === hoje.getFullYear());
      else if (filterDate === 'Este Ano') filtered = filtered.filter(t => new Date(t.timestamp).getFullYear() === hoje.getFullYear());
    }
    return filtered.sort((a, b) => a.timestamp - b.timestamp);
  }, [transactions, filterDate, filterCategory, startDate, endDate]);

  const { entradas, saidas } = filteredTransactions.reduce((acc, cur) => {
    if (cur.type === 'income') acc.entradas += cur.amount;
    else acc.saidas += cur.amount;
    return acc;
  }, { entradas: 0, saidas: 0 });
  
  const saldoAtual = entradas - saidas;
  const margem = entradas > 0 ? ((saldoAtual / entradas) * 100).toFixed(1) : 0;
  const saldoColorClass = saldoAtual < 0 ? 'text-rose-500' : 'text-emerald-500';

  const nexusScore = useMemo(() => {
    if (entradas === 0 && saidas === 0) return 0;
    if (entradas === 0 && saidas > 0) return 15;
    if (margem >= 20) return 95;
    if (margem >= 10) return 85;
    if (margem >= 0) return 70;
    if (margem > -20) return 40;
    return 25;
  }, [entradas, saidas, margem]);
  const scoreColor = nexusScore >= 70 ? 'text-emerald-500' : nexusScore >= 40 ? 'text-amber-500' : 'text-rose-500';

  const expenseCategories = useMemo(() => {
    const data = {};
    filteredTransactions.filter(t => t.type === 'expense').forEach(tx => data[tx.category] = (data[tx.category] || 0) + tx.amount);
    return Object.keys(data).map(k => ({ name: k, value: data[k] })).sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  const insights = useMemo(() => {
    const msgs = [];
    if (entradas === 0 && saidas === 0) return [{ type: 'info', icon: '🔍', text: 'Importe um extrato CSV ou conecte seu banco.' }];
    if (saidas > entradas && entradas > 0) msgs.push({ type: 'danger', icon: '⚠️', text: `Atenção: Despesas superaram receitas em R$ ${formatMoney(Math.abs(saldoAtual))}.` });
    else if (margem >= 20) msgs.push({ type: 'success', icon: '🟢', text: `Excelente! Poupou ${showValues ? margem + '%' : '••%'} das receitas.` });

    if (expenseCategories.length > 0) {
      const topCat = expenseCategories[0];
      const percent = ((topCat.value / saidas) * 100).toFixed(0);
      if (percent > 40) msgs.push({ type: 'warning', icon: '🟡', text: `Alerta: '${topCat.name}' representa ${showValues ? percent + '%' : '••%'} das despesas.` });
    }
    return msgs;
  }, [entradas, saidas, margem, expenseCategories, saldoAtual, showValues]);

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

  return (
    <div className={`min-h-screen ${s.bgApp} ${s.textMain} p-4 md:p-6 font-sans pb-20 relative transition-colors duration-300`}>
      
      {/* Modal Edição */}
      {editingTx && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${s.bgCard} ${s.borderCard} border rounded-xl p-6 w-full max-w-md shadow-2xl`}>
            <h3 className="text-lg font-bold mb-2">Editar Categoria</h3>
            <p className={`text-sm ${s.textMuted} mb-4 break-words`}>Transação: <span className="font-medium">{editingTx.description}</span></p>
            
            <div className="space-y-4">
              <div>
                <label className={`block text-xs font-semibold ${s.textMuted} mb-1`}>Nova Categoria</label>
                <input 
                  type="text" value={editCategory} onChange={(e) => setEditCategory(e.target.value)}
                  className={`w-full ${s.bgInput} ${s.borderInput} border rounded p-2.5 outline-none`}
                />
              </div>
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={saveAsRule} onChange={(e) => setSaveAsRule(e.target.checked)} className="mt-1" />
                  <div>
                    <span className="text-sm font-medium block">Aprender esta regra</span>
                    <span className={`text-xs ${s.textMuted} block mt-0.5`}>Categorizar automaticamente futuros gastos:</span>
                  </div>
                </label>
                {saveAsRule && (
                  <input 
                    type="text" value={editKeyword} onChange={(e) => setEditKeyword(e.target.value)}
                    className={`w-full mt-3 ${s.bgInput} ${s.borderInput} border rounded p-2 text-sm outline-none`}
                    placeholder="Palavra-chave (Ex: petrogarca)"
                  />
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditingTx(null)} className={`px-4 py-2 rounded text-sm ${s.textMuted} hover:bg-gray-500/10`}>Cancelar</button>
              <button onClick={saveCategoryEdit} className="px-4 py-2 rounded text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-medium">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* CABEÇALHO */}
      <header className={`flex flex-col md:flex-row justify-between items-center mb-6 gap-4 border-b ${s.borderCard} pb-4`}>
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">NEXUSFIN</h1>
              <p className="text-xs text-indigo-500 font-medium">Inteligência Financeira Ativa</p>
            </div>
          </div>
          
          {/* BOTÃO TEMA (SOL/LUA) - Visível no topo mobile */}
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="md:hidden p-2 rounded-full bg-indigo-500/10 text-indigo-500">
            {theme === 'dark' ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>}
          </button>
        </div>
        
        {/* BOTÕES DE AÇÃO (MOBILE OTIMIZADO) */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto justify-center md:justify-end items-center">
          {/* TEMA PC */}
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={`hidden md:flex p-2 rounded-full ${s.bgInput} ${s.borderInput} border mr-2`}>
            {theme === 'dark' ? <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg> : <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>}
          </button>

          <button onClick={() => setShowValues(!showValues)} className={`text-xs md:text-sm px-3 py-2 rounded-md transition-all border ${s.bgInput} ${s.borderInput}`}>
            {showValues ? 'Ocultar Valores' : 'Mostrar Valores'}
          </button>
          <button onClick={requestPluggyToken} className="bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs md:text-sm px-3 py-2 rounded-md font-medium flex items-center gap-1">
            <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /></svg>
            Conectar Banco
          </button>
          <label className="cursor-pointer bg-indigo-600 text-white text-xs md:text-sm px-3 py-2 rounded-md font-medium shadow-md">
            + Importar CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
          </label>
          <button onClick={handleClearDatabase} className="bg-rose-600/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs md:text-sm px-3 py-2 rounded-md">
            Limpar
          </button>
        </div>
      </header>

      {/* FILTROS E ABAS */}
      <div className={`flex flex-col lg:flex-row justify-between items-center ${s.bgCard} p-3 rounded-lg border ${s.borderCard} mb-6 gap-4`}>
        <div className={`flex w-full lg:w-auto p-1 rounded-md border ${s.borderInput} ${s.bgInput}`}>
          <button onClick={() => setActiveTab('dashboard')} className={`flex-1 px-4 py-1.5 rounded text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : s.textMuted}`}>Visão Executiva</button>
          <button onClick={() => setActiveTab('extrato')} className={`flex-1 px-4 py-1.5 rounded text-sm font-medium transition-all ${activeTab === 'extrato' ? 'bg-indigo-600 text-white' : s.textMuted}`}>Extrato Base</button>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full lg:w-auto items-center">
          <select value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className={`${s.bgInput} ${s.borderInput} border rounded p-1.5 text-sm outline-none w-full md:w-auto`}>
            <option>Últimos 15 dias</option>
            <option>Últimos 30 dias</option>
            <option>Este Mês</option>
            <option>Este Ano</option>
            <option>Desde o Início</option>
            <option>Personalizado</option>
          </select>
          {filterDate === 'Personalizado' && (
            <div className={`flex items-center gap-1 ${s.bgInput} border ${s.borderInput} p-1 rounded`}>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent text-xs outline-none px-1" />
              <span className="text-xs">até</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent text-xs outline-none px-1" />
            </div>
          )}
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className={`${s.bgInput} ${s.borderInput} border rounded p-1.5 text-sm outline-none w-full md:w-auto`}>
            {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
      </div>

      {activeTab === 'dashboard' && (
        <div className="animate-fade-in space-y-6">
          {insights.length > 0 && (
            <div className={`bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 flex flex-col gap-2`}>
              <h3 className="text-xs uppercase text-indigo-500 font-bold mb-1">Nexus Insights</h3>
              {insights.map((insight, idx) => (
                <div key={idx} className={`flex items-center gap-2 text-sm ${s.bgInput} p-3 rounded-lg border ${s.borderInput}`}>
                  <span>{insight.icon}</span><p>{insight.text}</p>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className={`${s.bgCard} p-5 rounded-xl border ${s.borderCard} shadow-sm relative overflow-hidden flex flex-col justify-center`}>
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full"></div>
              <p className={`text-xs font-semibold uppercase mb-1 ${s.textMuted}`}>Nexus Score</p>
              <h2 className={`text-3xl font-bold ${scoreColor}`}>{showValues ? nexusScore : '••'}<span className="text-lg text-gray-400">/100</span></h2>
            </div>
            <div className={`${s.bgCard} border ${s.borderCard} p-5 rounded-xl shadow-sm flex flex-col justify-center`}>
              <p className={`text-xs font-semibold uppercase mb-1 ${s.textMuted}`}>Receitas</p>
              <h2 className="text-2xl font-bold text-indigo-500">R$ {formatMoney(entradas)}</h2>
            </div>
            <div className={`${s.bgCard} border ${s.borderCard} p-5 rounded-xl shadow-sm flex flex-col justify-center`}>
              <p className={`text-xs font-semibold uppercase mb-1 ${s.textMuted}`}>Despesas</p>
              <h2 className="text-2xl font-bold text-rose-500">R$ {formatMoney(saidas)}</h2>
            </div>
            <div className={`${s.bgCard} border ${saldoAtual < 0 ? 'border-rose-500/50' : 'border-emerald-500/50'} p-5 rounded-xl shadow-sm flex flex-col justify-center`}>
              <p className={`text-xs font-semibold uppercase mb-1 ${s.textMuted}`}>Disponível</p>
              <h2 className={`text-2xl font-bold ${saldoColorClass}`}>R$ {formatMoney(saldoAtual)}</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className={`col-span-1 lg:col-span-2 ${s.bgCard} p-5 rounded-xl border ${s.borderCard} shadow-sm h-[300px] md:h-[350px]`}>
              <h3 className={`font-medium text-sm mb-4 ${s.textMuted}`}>Fluxo de Caixa</h3>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolutionData}>
                  <defs>
                    <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient>
                    <linearGradient id="colorDesp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/><stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={s.chartGrid} vertical={false} />
                  <XAxis dataKey="name" stroke={s.chartText} tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                  <YAxis stroke={s.chartText} tick={{fontSize: 10}} tickLine={false} axisLine={false} tickFormatter={(val) => showValues ? `R$${val/1000}k` : '••'} width={45} />
                  <RechartsTooltip formatter={(val) => showValues ? `R$ ${val.toLocaleString('pt-BR')}` : 'R$ ••'} contentStyle={{ backgroundColor: theme==='dark'?'#0f172a':'#fff', border: `1px solid ${theme==='dark'?'#1e293b':'#e2e8f0'}`, borderRadius: '8px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Area type="monotone" dataKey="Receitas" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorRec)" />
                  <Area type="monotone" dataKey="Despesas" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorDesp)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className={`col-span-1 ${s.bgCard} p-5 rounded-xl border ${s.borderCard} shadow-sm h-[300px] md:h-[350px] flex flex-col`}>
              <h3 className={`font-medium text-sm mb-2 ${s.textMuted}`}>Despesas por Categoria</h3>
              {expenseCategories.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expenseCategories} cx="50%" cy="45%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                      {expenseCategories.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS_EXPENSE[index % COLORS_EXPENSE.length]} />)}
                    </Pie>
                    <RechartsTooltip formatter={(val) => showValues ? `R$ ${val.toLocaleString('pt-BR')}` : 'R$ ••'} contentStyle={{ backgroundColor: theme==='dark'?'#0f172a':'#fff', border: `1px solid ${theme==='dark'?'#1e293b':'#e2e8f0'}`, borderRadius: '8px' }} />
                    <Legend layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm opacity-50">Sem dados.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'extrato' && (
         <div className={`${s.bgCard} rounded-xl border ${s.borderCard} shadow-sm animate-fade-in`}>
           <div className={`p-4 border-b ${s.borderCard} ${s.bgInput} rounded-t-xl flex justify-between items-center`}>
             <h2 className="text-sm font-semibold uppercase tracking-wider">Base de Dados Bruta</h2>
             <span className="bg-indigo-500/10 text-indigo-500 text-xs px-2 py-1 rounded-full font-medium">{filteredTransactions.length}</span>
           </div>
           <div className={`divide-y ${s.borderCard} max-h-[70vh] overflow-y-auto`}>
             {filteredTransactions.map((tx) => (
               <div key={tx.id} className={`p-3 px-4 ${s.bgHover} flex flex-col sm:flex-row sm:justify-between sm:items-center transition-colors group`}>
                 <div className="flex items-start sm:items-center gap-3 w-full sm:w-auto">
                   <div className={`w-2 h-2 rounded-full mt-1.5 sm:mt-0 flex-shrink-0 ${tx.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                   <div className="overflow-hidden w-full">
                     <p className="font-medium text-sm truncate" title={tx.description}>{tx.description}</p>
                     <p className={`text-xs ${s.textMuted} flex flex-wrap items-center gap-1.5 mt-1`}>
                       <span>{new Date(tx.timestamp).toLocaleDateString('pt-BR')}</span>
                       <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                       
                       <span className={`border ${s.borderInput} ${s.bgInput} px-1.5 py-0.5 rounded flex items-center gap-1`}>
                         {tx.category}
                         <button onClick={() => openEditModal(tx)} className="hover:text-indigo-500 ml-1">✏️</button>
                       </span>
                     </p>
                   </div>
                 </div>
                 <div className={`font-semibold text-sm mt-2 sm:mt-0 self-end sm:self-auto ${tx.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                   {tx.type === 'income' ? '+' : '-'} R$ {formatMoney(tx.amount)}
                 </div>
               </div>
             ))}
           </div>
         </div>
      )}

      {pluggyToken && (
        <PluggyConnect
          connectToken={pluggyToken}
          includesSandbox={false}
          onSuccess={async (itemData) => {
            try {
              const response = await fetch(`https://nexus-backend-fv9d.onrender.com/api/transactions/${itemData.item.id}`);
              const data = await response.json();
              const currentRules = await db.customRules.toArray();
              const transactionsToSave = (data.results || data).map(tx => ({
                type: tx.amount > 0 ? 'income' : 'expense',
                amount: Math.abs(tx.amount),
                description: tx.description || 'Transação Bancária',
                category: autoCategorize(tx.description || '', tx.amount, currentRules),
                date: new Date(tx.date).toISOString(),
                timeString: 'Pluggy',
                timestamp: new Date(tx.date).getTime()
              }));
              await db.transactions.bulkAdd(transactionsToSave);
              setPluggyToken('');
              loadData();
            } catch(e) { setPluggyToken(''); }
          }}
          onError={() => setPluggyToken('')}
          onClose={() => setPluggyToken('')}
        />
      )}
    </div>
  );
}
