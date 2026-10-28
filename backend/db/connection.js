'use strict';
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT, 10) || 3307,
  user: process.env.DB_USER || 'reservas_app',
  password: process.env.DB_PASSWORD || 'secret_app_password',
  database: process.env.DB_NAME || 'reservas_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true
});

pool.getConnection()
  .then((conn) => {
    console.log('✅ Conexión exitosa al pool de MySQL');
    conn.release();
  })
  .catch((err) => {
    console.error('❌ Error conectando a la base de datos:', err.message);
  });

module.exports = pool;
