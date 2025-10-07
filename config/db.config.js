const mysql = require("mysql2/promise");

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  database: process.env.DB_NAME || "power_monitoring",
  port: process.env.DB_PORT || 3306,
  password: process.env.DB_PASSWORD || "root",
};

const connection = mysql.createPool(dbConfig);

module.exports = connection;
