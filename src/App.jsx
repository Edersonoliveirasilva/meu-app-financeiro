import React, { useState, useEffect, useMemo } from 'react';
import Dexie from 'dexie';
import { PluggyConnect } from 'react-pluggy-connect';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

// Inicialização da Base de Dados Local
const db = new Dexie('NexusFinDB');
db.version(1).stores({
  transactions: '++id, type, amount, description, category, date, timeString, timestamp'
});

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [pluggyToken, setPluggyToken] = useState('');
  
  // Estado para alternar entre as Vistas (Tabs)
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' ou 'extrato'

  // Estados dos Filtros
  const [filterType, setFilterType] = useState('Todas as Operações');
  const [filterDate, setFilterDate] = useState('Últimos 30 dias');
  const [filterCategory, setFilterCategory] = useState('Todas');

  // Paleta de Cores para os Gráficos
  const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

  const loadData = async () => {
    const allTx = await db.transactions.toArray();
    allTx.sort((a, b) => b.timestamp - a.timestamp);
    setTransactions(allTx);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Extrair categorias únicas para o Select dinâmico
  const uniqueCategories = useMemo(() => {
    const cats = transactions.map(t => t.category || 'Geral');
    return ['Todas', ...new Set(cats)];
  }, [transactions]);

  // Importação do Extrato Nubank via CSV
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

            newTransactions.push({
              type: valor < 0 ? 'expense' : 'income',
              amount: Math.abs(valor),
              description: descricao,
              category: 'Geral', // Pode ajustar se o CSV tiver coluna de categoria
              date: txDate.toISOString(),
              timeString: 'Offline',
              timestamp: txDate.getTime()
            });
          }
        }

        await db.transactions.bulkAdd(newTransactions);
        alert(`Sucesso! ${newTransactions.length} transações importadas.`);
        event.target.value = '';
        loadData(); 
      } catch (error) {
        console.error("Erro ao ler o CSV:", error);
        alert("Ocorreu um erro ao importar. Verifique o ficheiro CSV.");
      }
    };
    reader.readAsText(file);
  };

  // Lógica de Filtragem Universal
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;
    const agora = new Date().getTime();
    const hoje = new Date();

    // Filtro por Tipo
    if (filterType === 'Entradas') filtered = filtered.filter(t => t.type === 'income');
    if (filterType === 'Saídas') filtered = filtered.filter(t => t.type === 'expense');

    // Filtro por Categoria
    if (filterCategory !== 'Todas') {
      filtered = filtered.filter(t => (t.category || 'Geral') === filterCategory);
    }

    // Filtro de Tempo Avançado
    if (filterDate === 'Últimos 7 dias') {
      filtered = filtered.filter(t => t.timestamp >= agora - (7 * 24 * 60 * 60 * 1000));
    } else if (filterDate === 'Últimos 30 dias') {
      filtered = filtered.filter(t => t.timestamp >= agora - (30 * 24 * 60 * 60 * 1000));
    } else if (filterDate === 'Últimos 90 dias') {
      filtered = filtered.filter(t => t.timestamp >= agora - (90 * 24 * 60 * 60 * 1000));
    } else if (filterDate === 'Este Mês') {
      filtered = filtered.filter(t => {
        const d = new Date(t.timestamp);
        return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
      });
    } else if (filterDate === 'Este Ano') {
      filtered = filtered.filter(t => new Date(t.timestamp).getFullYear() === hoje.getFullYear());
    }

    return filtered;
  }, [transactions, filterType, filterDate, filterCategory]);

  // Cálculos de KPI
  const { entradas, saidas } = filteredTransactions.reduce(
    (acc, cur) => {
      if (cur.type === 'income') acc.entradas += cur.amount;
      else acc.saidas += cur.amount;
      return acc;
    },
    { entradas: 0, saidas: 0 }
  );
  const saldoAtual = entradas - saidas;

  // Preparação de Dados para o Gráfico de Categorias (Apenas Saídas)
  const categoryChartData = useMemo(() => {
    const despesas = filteredTransactions.filter(t => t.type === 'expense');
    const somatorio = despesas.reduce((acc, tx) => {
      const cat = tx.category || 'Geral';
      acc[cat] = (acc[cat] || 0) + tx.amount;
      return acc;
    }, {});
    
    return Object.keys(somatorio)
      .map(key => ({ name: key, value: somatorio[key] }))
      .sort((a, b) => b.value - a.value); // Ordena das maiores para as menores
  }, [filteredTransactions]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8 font-sans selection:bg-emerald-500/30">
      
      {/* CABEÇALHO */}
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold text-emerald-400 flex items-center gap-2 tracking-tight">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          NEXUSFIN
        </h1>
        
        <div className="flex flex-wrap gap-3">
          <label className="cursor-pointer bg-blue-600/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500 hover:text-white px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Importar CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
          </label>

          <button 
            onClick={() => {
              // Coloque aqui a sua função de request do Token Pluggy ao backend
            }}
            className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500 hover:text-white px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Conectar ao Banco
          </button>
        </div>
      </header>

      {/* PAINEL DE RESUMO DE SALDOS */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl flex flex-col justify-center">
          <p className="text-gray-400 mb-1 text-sm font-medium uppercase tracking-wider">Saldo Atual</p>
          <h2 className="text-4xl font-bold text-white">R$ {saldoAtual.toFixed(2)}</h2>
        </div>
        <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl flex flex-col justify-center">
          <p className="text-emerald-400 flex items-center gap-1 mb-1 text-sm font-medium uppercase tracking-wider">
             <span>↑</span> Total Entradas
          </p>
          <h3 className="text-3xl font-semibold text-white">R$ {entradas.toFixed(2)}</h3>
        </div>
        <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl flex flex-col justify-center">
          <p className="text-red-400 flex items-center gap-1 mb-1 text-sm font-medium uppercase tracking-wider">
             <span>↓</span> Total Saídas
          </p>
          <h3 className="text-3xl font-semibold text-white">R$ {saidas.toFixed(2)}</h3>
        </div>
      </section>

      {/* CONTROLO DE ABAS E FILTROS */}
      <section className="flex flex-col md:flex-row justify-between items-center bg-gray-800 p-2 md:p-3 rounded-xl border border-gray-700 mb-6 gap-4 shadow-md">
        
        {/* Toggle Dashboard / Extrato */}
        <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700 w-full md:w-auto">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-emerald-500/20 text-emerald-400 shadow' : 'text-gray-400 hover:text-white'}`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('extrato')}
            className={`flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'extrato' ? 'bg-emerald-500/20 text-emerald-400 shadow' : 'text-gray-400 hover:text-white'}`}
          >
            Extrato
          </button>
        </div>

        {/* Filtros Dropdowns */}
        <div className="flex flex-wrap md:flex-nowrap gap-3 w-full md:w-auto">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-sm text-gray-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none flex-1">
            <option>Todas as Operações</option>
            <option>Entradas</option>
            <option>Saídas</option>
          </select>
          
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-sm text-gray-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none flex-1">
            {uniqueCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="bg-gray-900 border border-gray-600 rounded-lg p-2.5 text-sm text-gray-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none flex-1">
            <option>Últimos 7 dias</option>
            <option>Últimos 30 dias</option>
            <option>Últimos 90 dias</option>
            <option>Este Mês</option>
            <option>Este Ano</option>
            <option>Desde o Início</option>
          </select>
        </div>
      </section>

      {/* RENDERIZAÇÃO CONDICIONAL: DASHBOARD VS EXTRATO */}
      {filteredTransactions.length === 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center text-gray-400 flex flex-col items-center">
          <svg className="w-16 h-16 mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          <p className="text-lg">Nenhum registo encontrado para os filtros selecionados.</p>
        </div>
      ) : (
        <>
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 animate-fade-in">
              {/* Gráfico de Barras: Fluxo de Caixa */}
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-lg h-96 flex flex-col">
                <h3 className="text-gray-300 font-semibold mb-6 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Análise de Fluxo
                </h3>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[{ name: 'Período Selecionado', Entradas: entradas, Saídas: saidas }]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                    <XAxis dataKey="name" stroke="#9CA3AF" tick={{fill: '#9CA3AF'}} tickLine={false} axisLine={false} />
                    <YAxis stroke="#9CA3AF" tick={{fill: '#9CA3AF'}} tickLine={false} axisLine={false} />
                    <RechartsTooltip cursor={{fill: '#374151', opacity: 0.4}} contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="Entradas" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={80} />
                    <Bar dataKey="Saídas" fill="#EF4444" radius={[6, 6, 0, 0]} maxBarSize={80} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Gráfico Circular: Despesas por Categoria */}
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-lg h-96 flex flex-col">
                <h3 className="text-gray-300 font-semibold mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  Despesas por Categoria
                </h3>
                {categoryChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={110}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="none"
                      >
                        {categoryChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        formatter={(value) => `R$ ${value.toFixed(2)}`}
                        contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                      />
                      <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '13px', color: '#D1D5DB' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-500">Sem saídas neste período.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'extrato' && (
            <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-lg animate-fade-in">
              <div className="p-5 border-b border-gray-700 flex justify-between items-center bg-gray-800/50">
                <h2 className="text-lg font-semibold text-white">Histórico de Transações</h2>
                <span className="bg-gray-700 text-xs px-3 py-1.5 rounded-full text-gray-300 font-medium">{filteredTransactions.length} registos</span>
              </div>
              
              <div className="divide-y divide-gray-700 max-h-[600px] overflow-y-auto custom-scrollbar">
                {filteredTransactions.map((tx) => (
                  <div key={tx.id} className="p-4 px-6 hover:bg-gray-750 flex flex-col sm:flex-row sm:justify-between sm:items-center transition-colors group gap-2 sm:gap-0">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${tx.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {tx.type === 'income' ? '↓' : '↑'}
                      </div>
                      <div>
                        <p className="text-white font-medium group-hover:text-emerald-300 transition-colors">{tx.description}</p>
                        <p className="text-sm text-gray-400 flex items-center gap-2">
                          <span>{new Date(tx.date).toLocaleDateString('pt-BR')}</span>
                          <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                          <span className="bg-gray-700/50 px-2 py-0.5 rounded text-xs">{tx.category || 'Geral'}</span>
                        </p>
                      </div>
                    </div>
                    <div className={`font-semibold text-lg text-right ${tx.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {tx.type === 'income' ? '+' : '-'} R$ {tx.amount.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* COMPONENTE PLUGGY (Oculto até ser ativado pelo botão) */}
      {pluggyToken && (
        <PluggyConnect
          connectToken={pluggyToken}
          includesSandbox={false}
          onSuccess={async (itemData) => {
            try {
              const response = await fetch(`https://nexus-backend-fv9d.onrender.com/api/transactions/${itemData.item.id}`);
              if (!response.ok) throw new Error(`Falha no servidor: ${response.status}`);
              const data = await response.json();
              
              const txList = data.results || data;
              if (!txList || !Array.isArray(txList)) throw new Error("Lista inválida.");

              const transactionsToSave = txList.map(tx => ({
                type: tx.amount > 0 ? 'income' : 'expense',
                amount: Math.abs(tx.amount),
                description: tx.description || 'Transação Bancária',
                category: tx.category || 'Banco',
                date: new Date(tx.date).toISOString(),
                timeString: 'Importado',
                timestamp: new Date(tx.date).getTime()
              }));

              await db.transactions.bulkAdd(transactionsToSave);
              setPluggyToken('');
              loadData();
            } catch(e) {
              console.error("Erro na importação:", e);
              alert(`Erro: ${e.message}`);
              setPluggyToken('');
            }
          }}
          onError={(error) => {
            console.error('Erro na Pluggy:', error);
            setPluggyToken('');
          }}
          onClose={() => setPluggyToken('')}
        />
      )}
    </div>
  );
}