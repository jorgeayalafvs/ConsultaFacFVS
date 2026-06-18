// scripts/createUser.js
// -----------------------------------------------------------------------
// Script para crear (o resetear) el acceso de un cliente final.
// Uso:
//   node src/scripts/createUser.js <cedula> <custCode> <nombre>
//
// El ingreso se realiza solo con cedula. Se guarda un hash interno
// inutilizado para mantener compatibilidad con la tabla existente.
//
// Ejemplo:
//   node src/scripts/createUser.js 4123456 CLI0001 "Juan Perez"
// -----------------------------------------------------------------------

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../db/usersDb');

function main() {
  const [, , cedula, custCode, nombre] = process.argv;

  if (!cedula || !custCode) {
    console.log('Uso: node src/scripts/createUser.js <cedula> <custCode> [nombre]');
    process.exit(1);
  }

  const hash = bcrypt.hashSync(`cedula-login-disabled-${Date.now()}`, 10);

  const existente = db.prepare('SELECT id FROM app_users WHERE cedula = ?').get(cedula);

  if (existente) {
    db.prepare(
      `UPDATE app_users
       SET cust_code = ?, nombre = ?, password_hash = ?, activo = 1,
           must_change_password = 0, updated_at = datetime('now')
       WHERE cedula = ?`
    ).run(custCode, nombre || null, hash, cedula);
    console.log(`Usuario ${cedula} actualizado.`);
  } else {
    db.prepare(
      `INSERT INTO app_users (cedula, cust_code, nombre, password_hash, must_change_password)
       VALUES (?, ?, ?, ?, 0)`
    ).run(cedula, custCode, nombre || null, hash);
    console.log(`Usuario ${cedula} creado.`);
  }

  console.log('---------------------------------------------');
  console.log(`Cedula (usuario):       ${cedula}`);
  console.log(`Codigo de cliente:      ${custCode}`);
  console.log('---------------------------------------------');
  console.log('El cliente ya puede ingresar solo con su cedula.');
}

main();
