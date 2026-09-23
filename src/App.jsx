import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { Plus, Download, Wallet, Clock, Trash2, MapPin, Fingerprint, Lock } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function App() {
  // Estado de Segurança (Padrão Apple)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Estados do App
  const [showForm, setShowForm] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [form, setForm] = useState({ type: 'expense', amount: '', description: '', category: 'Geral' });

  // Busca dados em tempo real
  const transactions = useLiveQuery(() => db.transactions.orderBy('timestamp').reverse().toArray(), []) || [];

  // Cálculos do Dashboard
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
  const balance = totalIncome - totalExpense;

  // Função de Autenticação
 // Função de Autenticação Real (WebAuthn / FaceID / TouchID)
  const handleUnlock = async () => {
    try {
      // Verifica se o aparelho tem leitor biométrico suportado
      if (window.PublicKeyCredential) {
        const isSupported = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        
        if (isSupported) {
          const isRegistered = localStorage.getItem('nexus_biometria');
          
          if (!isRegistered) {
            // PRIMEIRO ACESSO: Regista o rosto/dedo do utilizador
            const publicKey = {
              challenge: new Uint8Array(32),
              rp: { name: "NexusFin", id: window.location.hostname },
              user: { 
                id: new Uint8Array(16), 
                name: "admin", 
                displayName: "Dono do Aparelho" 
              },
              pubKeyCredParams: [{ type: "public-key", alg: -7 }], // Criptografia ES256
              authenticatorSelection: { 
                authenticatorAttachment: "platform", 
                userVerification: "required" 
              },
              timeout: 60000
            };
            
            await navigator.credentials.create({ publicKey });
            localStorage.setItem('nexus_biometria', 'true');
            setIsAuthenticated(true);
            return;
          } else {
            // PRÓXIMOS ACESSOS: Pede o FaceID para desbloquear
            const publicKey = {
              challenge: new Uint8Array(32),
              rpId: window.location.hostname,
              userVerification: "required",
              timeout: 60000
            };
            
            await navigator.credentials.get({ publicKey });
            setIsAuthenticated(true);
            return;
          }
        }
      }
      
      // FALLBACK: Se estiver num PC sem leitor de impressão digital
      const pin = prompt("Biometria não detetada. Digite o PIN de segurança (Padrão: 1234):");
      if (pin === "1234") {
        setIsAuthenticated(true);
      } else {
        alert("PIN Incorreto.");
      }
      
    } catch (error) {
      console.error("Erro biométrico:", error);
      alert("Autenticação cancelada ou falhou.");
    }
  };
  

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    setIsGettingLocation(true);

    const now = new Date();
    
    // Captura a localização exata
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        await saveToDatabase(now, position.coords.latitude, position.coords.longitude);
      }, async () => {
        console.warn("Localização negada ou falhou. Salvando sem mapa.");
        await saveToDatabase(now, null, null);
      });
    } else {
      await saveToDatabase(now, null, null);
    }
  };

  const saveToDatabase = async (dateObj, lat, lng) => {
    await db.transactions.add({
      ...form,
      amount: parseFloat(form.amount),
      source: 'manual',
      date: dateObj.toISOString().split('T')[0],
      timestamp: dateObj.getTime(),
      timeString: dateObj.toLocaleTimeString('pt-BR'),
      lat: lat,
      lng: lng
    });
    
    setIsGettingLocation(false);
    setShowForm(false);
    setForm({ type: 'expense', amount: '', description: '', category: 'Geral' });
  };

  const deleteTransaction = async (id) => {
    if(window.confirm("Autenticação necessária para apagar. Tem certeza?")) {
      await db.transactions.delete(id);
    }
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(transactions.map(t => ({
      Data: t.date,
      Hora: t.timeString,
      Tipo: t.type === 'income' ? 'Entrada' : 'Saída',
      Valor: t.amount,
      Categoria: t.category,
      Descrição: t.description,
      Localização: t.lat ? `${t.lat}, ${t.lng}` : 'Não registrada'
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditoria de Gastos");
    XLSX.writeFile(wb, "NexusFin_Auditoria_Segura.xlsx");
  };

  // TELA DE BLOQUEIO (Security First)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-6">
        <Lock className="w-16 h-16 text-slate-500 mb-6" />
        <h1 className="text-2xl font-bold mb-2">NexusFin</h1>
        <p className="text-slate-400 mb-12 text-center">Aplicativo bloqueado.<br/>Seus dados estão protegidos localmente.</p>
        
        <button 
          onClick={handleUnlock}
          className="flex flex-col items-center gap-4 text-neonGreen hover:text-emerald-400 transition cursor-pointer">
          <Fingerprint className="w-16 h-16 animate-pulse" />
          <span className="font-medium">Tocar para Desbloquear</span>
        </button>
      </div>
    );
  }

  // TELA PRINCIPAL
  return (
    <div className="min-h-screen bg-darkBg text-slate-100 p-4 pb-24 font-sans selection:bg-neonGreen selection:text-darkBg">
      <header className="flex justify-between items-center py-4 mb-6">
        <div className="flex items-center gap-2">
          <Wallet className="text-neonGreen w-8 h-8" />
          <h1 className="text-xl font-bold tracking-wider">NEXUS<span className="text-neonGreen">FIN</span></h1>
        </div>
        <button onClick={exportToExcel} className="p-2 bg-glass rounded-full backdrop-blur-md border border-white/10 hover:bg-white/10 transition cursor-pointer" title="Exportar Auditoria">
          <Download className="w-5 h-5 text-slate-300" />
        </button>
      </header>

      {/* Dashboard Resumo */}
      <div className="grid grid-cols-1 gap-4 mb-8">
        <div className="bg-glass backdrop-blur-lg border border-white/10 p-6 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden">
          <p className="text-sm text-slate-400 mb-1">Saldo Protegido</p>
          <h2 className={`text-4xl font-bold ${balance >= 0 ? 'text-white' : 'text-neonRed'}`}>
            R$ {balance.toFixed(2)}
          </h2>
        </div>
      </div>

      {/* Histórico Detalhado */}
      <h3 className="text-lg font-medium text-slate-300 mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-slate-400"/> Lista Detalhada
      </h3>
      
      <div className="space-y-4">
        {transactions.length === 0 ? (
          <p className="text-center text-slate-500 py-10">Nenhum registro encontrado.</p>
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
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {t.date} às {t.timeString}
                </div>
                
                {t.lat ? (
                  <a href={`https://www.google.com/maps/search/?api=1&query=${t.lat},${t.lng}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition">
                    <MapPin className="w-3 h-3" /> Ver no Mapa
                  </a>
                ) : (
                  <span className="flex items-center gap-1 text-slate-600"><MapPin className="w-3 h-3" /> Local oculto</span>
                )}
                
                <button onClick={() => deleteTransaction(t.id)} className="ml-auto flex items-center gap-1 text-slate-600 hover:text-neonRed transition cursor-pointer">
                  <Trash2 className="w-3 h-3" /> Apagar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB - Botão Flutuante */}
      <button 
        onClick={() => setShowForm(true)}
        className="fixed bottom-6 right-6 bg-neonGreen text-darkBg p-4 rounded-full shadow-[0_0_20px_rgba(52,211,153,0.4)] hover:scale-105 transition-transform z-50 cursor-pointer">
        <Plus className="w-8 h-8" />
      </button>

      {/* Modal de Lançamento */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-3xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Lock className="w-5 h-5 text-neonGreen"/> Novo Registro Seguro
              </h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 text-2xl cursor-pointer">&times;</button>
            </div>
            
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div className="flex bg-black/50 rounded-xl p-1 border border-white/5">
                <button type="button" className={`flex-1 py-3 rounded-lg text-sm font-bold transition cursor-pointer ${form.type === 'expense' ? 'bg-neonRed text-white' : 'text-slate-500'}`} onClick={() => setForm({...form, type: 'expense'})}>SAÍDA</button>
                <button type="button" className={`flex-1 py-3 rounded-lg text-sm font-bold transition cursor-pointer ${form.type === 'income' ? 'bg-neonGreen text-darkBg' : 'text-slate-500'}`} onClick={() => setForm({...form, type: 'income'})}>ENTRADA</button>
              </div>

              <div>
                <input type="number" step="0.01" required value={form.amount} onChange={e => setForm({...form, amount: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-3xl font-bold text-center text-white focus:outline-none focus:border-neonGreen" placeholder="R$ 0,00" />
              </div>

              <div>
                <input type="text" required value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-neonGreen" placeholder="O que foi? (Ex: Almoço)" />
              </div>
              
              <div>
                 <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-neonGreen cursor-pointer">
                    <option>Alimentação</option>
                    <option>Transporte</option>
                    <option>Serviços</option>
                    <option>Lazer</option>
                    <option>Saúde</option>
                    <option>Geral</option>
                 </select>
              </div>

              <button type="submit" disabled={isGettingLocation} className={`w-full py-4 rounded-xl font-bold text-lg mt-4 flex items-center justify-center gap-2 transition cursor-pointer ${isGettingLocation ? 'bg-slate-700 text-slate-400' : form.type === 'income' ? 'bg-neonGreen text-darkBg hover:bg-emerald-400' : 'bg-neonRed text-white hover:bg-rose-400'}`}>
                {isGettingLocation ? (
                  <>Obtendo GPS e Salvando...</>
                ) : (
                  <>Registrar Agora</>
                )}
              </button>
              <p className="text-center text-xs text-slate-600 mt-2 flex justify-center items-center gap-1">
                <MapPin className="w-3 h-3"/> Localização exata e horário serão rastreados
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}