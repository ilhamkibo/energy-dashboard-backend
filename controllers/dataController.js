const mysql = require("mysql2/promise");
const dbConfig = {
  host: "localhost",
  user: "root",
  database: "power_monitoring",
  port: 3306,
};

const getVoltData = async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);

    // Ambil parameter query
    const device = req.query.device;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const dateFilter = req.query.date;

    let sql;
    let params = [];
    let response = {
      status: "success",
      data: {},
      label: ["Volt 1", "Volt 2", "Volt 3"],
    };

    if (device) {
      response.label = ["Device 1", "Device 2", "Device 3"];
    }

    // Add your query logic here...

    const [result] = await connection.execute(sql, params);
    response.data = result;
    await connection.end();
    res.json(response);
  } catch (error) {
    console.error("Error fetching data from database:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { getVoltData };
