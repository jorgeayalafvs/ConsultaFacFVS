// middleware/auth.js
// -----------------------------------------------------------------------
// Verifica el token JWT enviado por el cliente en cada peticion a rutas
// protegidas. Si es valido, agrega los datos del usuario a req.user
// (incluyendo su cust_code, que es lo que se usa despues para filtrar
// SIEMPRE las facturas solo de ese cliente).
// -----------------------------------------------------------------------

const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'No autenticado. Falta el token.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, cedula, custCode, nombre }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalido o expirado. Vuelva a iniciar sesion.' });
  }
}

module.exports = { requireAuth };
