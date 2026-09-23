import Dexie from 'dexie';

export const db = new Dexie('FinanceAppDB');

// Banco de dados local configurado com suporte a GPS e Timestamp
db.version(2).stores({
  transactions: '++id, type, amount, category, date, timestamp, lat, lng, description, source'
});