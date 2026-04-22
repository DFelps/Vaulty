const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')
const { app } = require('electron')

let db

function getDbPath() {
  const userData = app.getPath('userData')
  const dataDir = path.join(userData, 'data')
  fs.mkdirSync(dataDir, { recursive: true })
  return path.join(dataDir, 'vaulty.db')
}

function initializeDatabase() {
  if (db) return db

  db = new Database(getDbPath())
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS vault_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      username TEXT,
      email TEXT,
      website TEXT,
      category TEXT,
      notes TEXT,
      encrypted_payload TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `)

  return db
}

module.exports = {
  initializeDatabase
}
