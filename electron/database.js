// electron/database.js

const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')
const { app } = require('electron')

let db

const SCHEMA_VERSION = 2

function getDbPath() {
  const userData = app.getPath('userData')
  const dataDir = path.join(userData, 'data')

  fs.mkdirSync(dataDir, { recursive: true })

  return path.join(dataDir, 'vaulty.db')
}

function migrateDatabase(database) {
  const currentVersion = database.pragma('user_version', { simple: true })

  if (currentVersion < 1) {
    database.exec(`
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

    database.pragma('user_version = 1')
  }

  if (currentVersion < 2) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `)

    database.pragma('user_version = 2')
  }
}

function initializeDatabase() {
  if (db) return db

  db = new Database(getDbPath())

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  migrateDatabase(db)

  return db
}

module.exports = {
  initializeDatabase,
  SCHEMA_VERSION
}