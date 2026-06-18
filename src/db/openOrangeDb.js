// db/openOrangeDb.js
// -----------------------------------------------------------------------
// Conexion a la base de datos REAL de Open Orange (MySQL), que vive en
// el servidor local de la empresa. Esta conexion sale a traves del
// tunel (Cloudflare Tunnel / WireGuard / etc.) que se configura en la
// PC de la empresa. La API nunca expone este host directamente al
// publico; solo esta API tiene estas credenciales.
//
// IMPORTANTE: el usuario MySQL configurado aqui deberia ser un usuario
// de SOLO LECTURA (GRANT SELECT) sobre las tablas necesarias, nunca el
// usuario administrador del ERP. Asi, aunque algo saliera mal, no se
// puede modificar ni borrar informacion del Open Orange desde esta API.
// -----------------------------------------------------------------------

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.OO_DB_HOST,
  port: Number(process.env.OO_DB_PORT || 3306),
  user: process.env.OO_DB_USER,
  password: process.env.OO_DB_PASSWORD,
  database: process.env.OO_DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  connectTimeout: 10000,
});

async function testConnection() {
  const conn = await pool.getConnection();
  try {
    await conn.query('SELECT 1');
    return true;
  } finally {
    conn.release();
  }
}

module.exports = { pool, testConnection };
