// scripts/createUser.js
// -----------------------------------------------------------------------
// Script para crear (o resetear) el acceso de un cliente final.
// Uso:
//   node src/scripts/createUser.js <cedula> <custCode> <nombre> [password]
//
// Si no se indica password, se genera una temporal aleatoria y se
// muestra en pantalla (el cliente la cambia en su primer ingreso,
// porque must_change_password queda en 1).
//
// Ejemplo:
//   node src/scripts/createUser.js 4123456 CLI0001 "Juan Perez"
// -----------------------------------------------------------------------

require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db/usersDb');

function generarPasswordTemporal() {
  return crypto.randomBytes(6).toString('base64').replace(/[+/=]/g, '').slice(0, 8);
}

function main() {
  const [, , cedula, custCode, nombre, passwordArg] = process.argv;

  if (!cedula || !custCode) {
    console.log('Uso: node src/scripts/createUser.js <cedula> <custCode> [nombre] [password]');
    process.exit(1);
  }

  const password = passwordArg || generarPasswordTemporal();
  const hash = bcrypt.hashSync(password, 10);

  const existente = db.prepare('SELECT id FROM app_users WHERE cedula = ?').get(cedula);

  if (existente) {
    db.prepare(
      `UPDATE app_users
       SET cust_code = ?, nombre = ?, password_hash = ?, activo = 1,
           must_change_password = 1, updated_at = datetime('now')
       WHERE cedula = ?`
    ).run(custCode, nombre || null, hash, cedula);
    console.log(`Usuario ${cedula} actualizado.`);
  } else {
    db.prepare(
      `INSERT INTO app_users (cedula, cust_code, nombre, password_hash, must_change_password)
       VALUES (?, ?, ?, ?, 1)`
    ).run(cedula, custCode, nombre || null, hash);
    console.log(`Usuario ${cedula} creado.`);
  }

  console.log('---------------------------------------------');
  console.log(`Cedula (usuario):       ${cedula}`);
  console.log(`Codigo de cliente:      ${custCode}`);
  console.log(`Contrasena temporal:    ${password}`);
  console.log('---------------------------------------------');
  console.log('Comparta esta contrasena de forma segura con el cliente.');
  console.log('Se le pedira cambiarla en su primer inicio de sesion.');
}

main();
