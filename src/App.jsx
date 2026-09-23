import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { Plus, Download, Wallet, Clock, Trash2, MapPin, Fingerprint, Lock, RefreshCcw, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { PluggyConnect } from 'react-pluggy-connect';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  
  // Estado inicial do formulário corrigido
  const [form, setForm] = useState({ type: 'expense', amount: '', description: '', category: 'Geral' });
  const [pluggyToken, setPluggyToken] = useState('');

  const transactions = useLiveQuery(() => db.transactions.orderBy('timestamp').reverse().toArray(), []) || [];

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
  const balance = totalIncome - totalExpense;

  const handleUnlock = async () => {
    setIsAuthenticated(true); // Desbloqueio direto para facilitar testes
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    setIsGettingLocation(true);
    const now = new Date();
    
    // Assegura que o valor gravado obedece ao tipo escolhido (income/expense)
    const transactionType = form.type; 

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        await saveToDatabase(now, position.coords.latitude, position.coords.longitude, transactionType);
      }, async () => {
        await saveToDatabase(now, null, null, transactionType);
      });
    } else {
      await saveToDatabase(now, null, null, transactionType);
    }
  };

  const saveToDatabase = async (dateObj, lat, lng, typeToSave) => {
    await db.transactions.add({
      type: typeToSave,
      amount: parseFloat(form.amount),
      description: form.description || 'Lançamento',
      category: form.category || 'Geral',
      source: 'manual',
      date: dateObj.toISOString().split('T')[0],
      timestamp: dateObj.getTime(),
      timeString: dateObj.toLocaleTimeString('pt-BR'),
      lat: lat,
      lng: lng
    });
    setIsGettingLocation(false);
    setShowForm(false);
    setForm({ type: 'expense', amount: '', description: '', category: 'Geral' }); // Reseta formulário
  };

  const deleteTransaction = async (id) => {
    if(window.confirm("Deseja mesmo apagar este registo?")) {
      await db.transactions.delete(id);
    }
  };

  const handleConnectBank = async () => {
    try {
      const response = await fetch('[https://nexus-backend-fv9d.onrender.com/api/token](https://nexus-backend-fv9d.onrender.com/api/token)')
      if (!response.ok) throw new Error("Erro no servidor");
      const data = await response.json();
      setPluggyToken(data.accessToken);
    } catch (error) {
      alert("ERRO LOCAL: O Servidor Backend (porta 3000) não está a responder. Certifique-se de que rodou 'node server.js'.");
    }
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(transactions.map(t => ({
      Data: t.date, Hora: t.timeString, Tipo: t.type === 'income' ? 'Entrada' : 'Saída',
      Valor: t.amount, Categoria: t.category, Descrição: t.description
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditoria");
    XLSX.writeFile(wb, "NexusFin_Auditoria.xlsx");
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-6">
        <Lock className="w-16 h-16 text-slate-500 mb-6" />
        <h1 className="text-2xl font-bold mb-2">NexusFin</h1>
        <button onClick={handleUnlock} className="flex flex-col items-center gap-4 text-neonGreen hover:text-emerald-400 transition cursor-pointer mt-8">
          <Fingerprint className="w-16 h-16 animate-pulse" />
          <span className="font-medium">Tocar para Desbloquear</span>
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-darkBg text-slate-100 p-4 pb-24 font-sans">
      <header className="flex justify-between items-center py-4 mb-6">
        <div className="flex items-center gap-2">
          <Wallet className="text-neonGreen w-8 h-8" />
          <h1 className="text-xl font-bold tracking-wider">NEXUS<span className="text-neonGreen">FIN</span></h1>
        </div>
        <div className="flex gap-3">
          <button onClick={exportToExcel} className="p-2 bg-glass rounded-full border border-white/10 hover:bg-white/10 transition cursor-pointer">
            <Download className="w-5 h-5 text-slate-300" />
          </button>
          <button onClick={handleConnectBank} className="p-2 bg-glass rounded-full border border-white/10 hover:bg-white/10 transition cursor-pointer">
            <RefreshCcw className="w-5 h-5 text-blue-400" />
          </button>
        </div>
      </header>

      {/* DASHBOARD */}
      <div className="bg-glass backdrop-blur-lg border border-white/10 p-6 rounded-2xl flex flex-col items-center justify-center relative mb-8">
        <p className="text-sm text-slate-400 mb-1">Saldo Atual</p>
        <h2 className={`text-4xl font-bold ${balance >= 0 ? 'text-white' : 'text-neonRed'}`}>R$ {balance.toFixed(2)}</h2>
        
        <div className="flex w-full justify-between mt-6 border-t border-white/10 pt-4">
           <div className="text-center">
             <p className="text-xs text-slate-400 flex items-center gap-1 justify-center"><ArrowUpCircle className="w-3 h-3 text-neonGreen"/> Entradas</p>
             <p className="font-bold text-neonGreen">R$ {totalIncome.toFixed(2)}</p>
           </div>
           <div className="text-center">
             <p className="text-xs text-slate-400 flex items-center gap-1 justify-center"><ArrowDownCircle className="w-3 h-3 text-neonRed"/> Saídas</p>
             <p className="font-bold text-neonRed">R$ {totalExpense.toFixed(2)}</p>
           </div>
        </div>
      </div>

      <h3 className="text-lg font-medium text-slate-300 mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-slate-400"/> Lista de Transações</h3>
      
      <div className="space-y-4">
        {transactions.length === 0 ? (
          <p className="text-center text-slate-500 py-10">Nenhum registo efetuado.</p>
        ) : (
          transactions.map(t => (
            <div key={t.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-bold text-slate-200 text-lg">{t.description}</span>
                  <span className="block text-sm text-slate-400">{t.category}</span>
                </div>
                <span className={`font-bold text-lg tracking-tight ${t.type === 'income' ? 'text-neonGreen' : 'text-neonRed'}`}>
                  {t.type === 'income' ? '+' : '-'} R$ {t.amount.toFixed(2)}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 pt-3 border-t border-white/5 text-xs text-slate-500">
                <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{t.date} às {t.timeString}</div>
                <button onClick={() => deleteTransaction(t.id)} className="ml-auto flex items-center gap-1 text-slate-600 hover:text-neonRed transition cursor-pointer"><Trash2 className="w-3 h-3" /> Apagar</button>
              </div>
            </div>
          ))
        )}
      </div>

      <button onClick={() => setShowForm(true)} className="fixed bottom-6 right-6 bg-neonGreen text-darkBg p-4 rounded-full shadow-[0_0_20px_rgba(52,211,153,0.4)] cursor-pointer"><Plus className="w-8 h-8" /></button>

      {pluggyToken && (
        <PluggyConnect
          connectToken={pluggyToken}
          includeSandbox={true}
          onSuccess={async (itemData) => {
            const itemId = itemData.item ? itemData.item.id : itemData.id;
            setPluggyToken(''); 
            
            try {
              const response = await fetch(`https://nexus-backend-fv9d.onrender.com/api/transactions/${itemId}`);
              
              if (!response.ok) {
                 const errData = await response.json();
                 throw new Error(errData.error || `Erro de código: ${response.status}`);
              }
              
              const data = await response.json();
              const transacoes = Array.isArray(data) ? data : (data.results || []);

              if (transacoes.length === 0) {
                 alert("BOM SINAL: A conexão funcionou! Mas a API da Pluggy disse que essa conta não tem transações recentes.");
                 return;
              }

              for (let t of transacoes) {
                const isIncome = t.amount > 0;
                await db.transactions.add({
                  type: isIncome ? 'income' : 'expense',
                  amount: Math.abs(t.amount),
                  description: t.description || 'Sincronização',
                  category: t.category || 'Banco',
                  date: t.date ? t.date.split('T')[0] : new Date().toISOString().split('T')[0],
                  timestamp: t.date ? new Date(t.date).getTime() : new Date().getTime(),
                  timeString: t.date ? new Date(t.date).toLocaleTimeString('pt-BR') : new Date().toLocaleTimeString('pt-BR'),
                  source: 'auto_bank'
                });
              }
              alert(`SUCESSO TOTAL! ${transacoes.length} gastos adicionados!`);
            } catch (err) {
              // ESTE ALERTA VAI MOSTRAR O ERRO REAL PARA NÓS
              alert(`ATENÇÃO - ERRO AO PUXAR DADOS:\n\n${err.message}`);
            }
          }}
          onError={() => setPluggyToken('')}
          onClose={() => setPluggyToken('')}
        />
      )}

      {/* MODAL CORRIGIDO DE LANÇAMENTO */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-3xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">Novo Lançamento</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 text-2xl cursor-pointer">&times;</button>
            </div>
            
            <form onSubmit={handleAddTransaction} className="space-y-4">
              
              {/* BOTÕES DE TIPO DE TRANSAÇÃO (SAÍDA / ENTRADA) - AGORA INFALÍVEIS */}
              <div className="flex bg-black/50 rounded-xl p-1 border border-white/5">
                <div 
                  className={`flex-1 py-3 rounded-lg text-sm font-bold text-center cursor-pointer transition ${form.type === 'expense' ? 'bg-neonRed text-white' : 'text-slate-500'}`} 
                  onClick={() => setForm({...form, type: 'expense'})}>
                  SAÍDA
                </div>
                <div 
                  className={`flex-1 py-3 rounded-lg text-sm font-bold text-center cursor-pointer transition ${form.type === 'income' ? 'bg-neonGreen text-darkBg' : 'text-slate-500'}`} 
                  onClick={() => setForm({...form, type: 'income'})}>
                  ENTRADA
                </div>
              </div>

              <div>
                <input type="number" step="0.01" required value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-3xl font-bold text-center text-white focus:outline-none focus:border-neonGreen" placeholder="R$ 0,00" />
              </div>

              <div>
                <input type="text" required value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-neonGreen" placeholder="Descrição" />
              </div>
              
              <div>
                 <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-neonGreen cursor-pointer">
                    <option>Alimentação</option>
                    <option>Transporte</option>
                    <option>Serviços</option>
                    <option>Saúde</option>
                    <option>Salário</option>
                    <option>Geral</option>
                 </select>
              </div>

              <button type="submit" disabled={isGettingLocation} className={`w-full py-4 rounded-xl font-bold text-lg mt-4 flex items-center justify-center gap-2 transition cursor-pointer ${isGettingLocation ? 'bg-slate-700 text-slate-400' : form.type === 'income' ? 'bg-neonGreen text-darkBg' : 'bg-neonRed text-white'}`}>
                {isGettingLocation ? 'Salvando...' : 'Confirmar Lançamento'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}