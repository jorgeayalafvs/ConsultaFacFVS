// db/usersDb.js
// -----------------------------------------------------------------------
// Base de datos PROPIA de la aplicacion (separada de Open Orange).
// Aqui se guardan los usuarios externos que pueden loguearse a la web
// (cedula + password) y a que CustCode de Open Orange corresponden.
//
// Usamos SQLite (better-sqlite3) porque es gratis, no requiere un
// servidor de base de datos aparte, y es mas que suficiente para esta
// cantidad de usuarios. El archivo .db queda en /data dentro del
// contenedor del servicio donde despliegues la API (Render/Railway).
// -----------------------------------------------------------------------

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'app_users.db');

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS app_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cedula TEXT NOT NULL UNIQUE,
    cust_code TEXT NOT NULL,
    nombre TEXT,
    password_hash TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
    must_change_password INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cedula TEXT NOT NULL,
    success INTEGER NOT NULL,
    ip TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;
