import React, { useState, useEffect, useMemo } from 'react';
import Dexie from 'dexie';
import { PluggyConnect } from 'react-pluggy-connect'; // Ajuste o import conforme a sua biblioteca
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

// Inicialização da Base de Dados Local (Dexie)
const db = new Dexie('NexusFinDB');
db.version(1).stores({
  transactions: '++id, type, amount, description, category, date, timeString, timestamp'
});

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [pluggyToken, setPluggyToken] = useState('');
  
  // Estados para Filtros
  const [filterType, setFilterType] = useState('Todas as Operações');
  const [filterDate, setFilterDate] = useState('Desde o Início');
  const [filterCategory, setFilterCategory] = useState('Todas');

  // Cores do Gráfico
  const COLORS = ['#10B981', '#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6'];

  // Carregar dados iniciais da base de dados local
  const loadData = async () => {
    const allTx = await db.transactions.toArray();
    // Ordenar das mais recentes para as mais antigas
    allTx.sort((a, b) => b.timestamp - a.timestamp);
    setTransactions(allTx);
  };

  useEffect(() => {
    loadData();
  }, []);

  // --------------------------------------------------------
  // NOVA FUNÇÃO: IMPORTAÇÃO DE CSV (O PLANO B)
  // --------------------------------------------------------
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
              category: 'Via CSV',
              date: txDate.toISOString(),
              timeString: 'Offline',
              timestamp: txDate.getTime()
            });
          }
        }

        await db.transactions.bulkAdd(newTransactions);
        alert(`Sucesso! ${newTransactions.length} transações importadas do ficheiro CSV.`);
        event.target.value = '';
        loadData(); // Recarrega os dados instantaneamente no ecrã

      } catch (error) {
        console.error("Erro ao ler o CSV:", error);
        alert("Ocorreu um erro. Verifique se o ficheiro é o CSV original exportado pelo Nubank.");
      }
    };
    reader.readAsText(file);
  };

  // --------------------------------------------------------
  // LÓGICA DE FILTRAGEM DE DADOS
  // --------------------------------------------------------
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    // Filtro por Tipo
    if (filterType === 'Entradas') filtered = filtered.filter(t => t.type === 'income');
    if (filterType === 'Saídas') filtered = filtered.filter(t => t.type === 'expense');

    // Filtro por Data
    if (filterDate === 'Últimos 30 dias') {
      const trintaDiasAtras = new Date().getTime() - (30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(t => t.timestamp >= trintaDiasAtras);
    } else if (filterDate === 'Este Mês') {
      const hoje = new Date();
      filtered = filtered.filter(t => {
        const txData = new Date(t.timestamp);
        return txData.getMonth() === hoje.getMonth() && txData.getFullYear() === hoje.getFullYear();
      });
    }

    // Filtro por Categoria
    if (filterCategory !== 'Todas') {
      filtered = filtered.filter(t => t.category === filterCategory);
    }

    return filtered;
  }, [transactions, filterType, filterDate, filterCategory]);

  // Cálculos do Dashboard
  const { entradas, saidas } = filteredTransactions.reduce(
    (acc, cur) => {
      if (cur.type === 'income') acc.entradas += cur.amount;
      else acc.saidas += cur.amount;
      return acc;
    },
    { entradas: 0, saidas: 0 }
  );
  const saldoAtual = entradas - saidas;

  // --------------------------------------------------------
  // RENDERIZAÇÃO DA INTERFACE (UI)
  // --------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8 font-sans">
      
      {/* CABEÇALHO COM BOTÕES DE AÇÃO */}
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-2xl font-bold text-emerald-400 flex items-center gap-2">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          NEXUSFIN
        </h1>
        
        <div className="flex flex-wrap gap-3">
          {/* BOTÃO PLANO B: IMPORTAR CSV */}
          <label className="cursor-pointer bg-blue-600/20 text-blue-400 border border-blue-500/50 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Importar CSV
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              onChange={handleImportCSV} 
            />
          </label>

          {/* BOTÃO ORIGINAL: CONECTAR AO BANCO (PLUGGY) */}
          <button 
            onClick={() => {
              // Lógica para pedir Token ao backend (Mantenha a sua função existente aqui)
              // Exemplo genérico: fetchToken().then(token => setPluggyToken(token));
            }}
            className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500 hover:text-white px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Conectar ao Banco
          </button>
        </div>
      </header>

      {/* PAINEL DE RESUMO (CARDS) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-lg text-center">
          <p className="text-gray-400 mb-1">Saldo Atual</p>
          <h2 className="text-4xl font-bold text-white">R$ {saldoAtual.toFixed(2)}</h2>
        </div>
        <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-lg flex flex-col justify-center">
          <p className="text-emerald-400 flex items-center gap-1 mb-1">
             <span className="text-xl">↑</span> Entradas
          </p>
          <h3 className="text-2xl font-semibold text-white">R$ {entradas.toFixed(2)}</h3>
        </div>
        <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-lg flex flex-col justify-center">
          <p className="text-red-400 flex items-center gap-1 mb-1">
             <span className="text-xl">↓</span> Saídas
          </p>
          <h3 className="text-2xl font-semibold text-white">R$ {saidas.toFixed(2)}</h3>
        </div>
      </section>

      {/* ÁREA DE FILTROS */}
      <section className="flex flex-wrap gap-4 mb-6 bg-gray-800 p-4 rounded-xl border border-gray-700">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-gray-900 border border-gray-600 rounded p-2 text-white">
          <option>Todas as Operações</option>
          <option>Entradas</option>
          <option>Saídas</option>
        </select>
        <select value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="bg-gray-900 border border-gray-600 rounded p-2 text-white">
          <option>Desde o Início</option>
          <option>Últimos 30 dias</option>
          <option>Este Mês</option>
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="bg-gray-900 border border-gray-600 rounded p-2 text-white">
          <option>Todas</option>
          <option>Via CSV</option>
          <option>Banco</option>
          {/* Adicione mais categorias dinâmicas aqui se desejar */}
        </select>
      </section>

      {/* ÁREA DE GRÁFICOS */}
      {filteredTransactions.length > 0 && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 h-80">
            <h3 className="text-gray-400 mb-4 text-center">Entradas vs Saídas</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[{ name: 'Resumo', Entradas: entradas, Saídas: saidas }]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none' }} />
                <Legend />
                <Bar dataKey="Entradas" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Saídas" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* LISTA DE TRANSAÇÕES */}
      <section className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-lg">
        <div className="p-4 border-b border-gray-700 flex items-center gap-2">
          <h2 className="text-lg font-semibold text-white">Extrato</h2>
          <span className="bg-gray-700 text-xs px-2 py-1 rounded-full text-gray-300">{filteredTransactions.length} registos</span>
        </div>
        
        {filteredTransactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Nenhum registo encontrado para estes filtros.
          </div>
        ) : (
          <div className="divide-y divide-gray-700 max-h-96 overflow-y-auto">
            {filteredTransactions.map((tx) => (
              <div key={tx.id} className="p-4 hover:bg-gray-750 flex justify-between items-center transition-colors">
                <div>
                  <p className="text-white font-medium">{tx.description}</p>
                  <p className="text-sm text-gray-400">
                    {new Date(tx.date).toLocaleDateString('pt-BR')} • {tx.category}
                  </p>
                </div>
                <div className={`font-semibold ${tx.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {tx.type === 'income' ? '+' : '-'} R$ {tx.amount.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* WIDGET DA PLUGGY (CONDICIONAL) */}
      {pluggyToken && (
        <PluggyConnect
          connectToken={pluggyToken}
          includesSandbox={false} // Mantenha false para dados de produção
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
              loadData(); // Atualiza a tela após gravar
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