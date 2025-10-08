const db = require("../config/db.config");
const { formatRowsToJakartaTime } = require("../utils/formatDate");

async function getVoltData(req, res) {
  try {
    const connection = await db.getConnection();
    const { startDate, endDate } = req.query;
    const response = {
      status: "success",
      message: "",
      data: [],
      label: "Volt",
    };

    let sql = "";
    let params = [];

    // ✅ 1. Tidak ada query param (ambil hari ini, data per jam)
    if (!startDate && !endDate) {
      sql = `
            SELECT 
                DATE_FORMAT(timestamp, '%H:00:00') AS time_label,
                MAX(volt1) AS volt,
                DATE_FORMAT(timestamp, '%Y-%m-%d') AS date
            FROM power_meter
            WHERE DATE(timestamp) = CURDATE()
            GROUP BY 
                DATE_FORMAT(timestamp, '%H:00:00'),
                DATE_FORMAT(timestamp, '%Y-%m-%d')
            ORDER BY time_label;
            `;
      response.message = "Data hari ini berhasil diambil";
    }

    // ✅ 2. Ada startDate tapi tidak ada endDate → ambil data pada hari itu
    else if (startDate && !endDate) {
      sql = `
        SELECT 
        DATE_FORMAT(timestamp, '%H:00:00') AS time_label,
        MAX(volt1) AS volt,
        DATE_FORMAT(timestamp, '%Y-%m-%d') AS date
        FROM power_meter
        WHERE DATE(timestamp) = DATE(?)
        GROUP BY 
        DATE_FORMAT(timestamp, '%H:00:00'),
        DATE_FORMAT(timestamp, '%Y-%m-%d')
        ORDER BY time_label;
      `;
      params = [startDate];
      response.message = `Data pada tanggal ${startDate} berhasil diambil`;
    }

    // ✅ 3. Ada startDate & endDate → ambil data tertinggi per hari
    else if (startDate && endDate) {
      sql = `
        SELECT 
          DATE(timestamp) AS date,
          MAX(volt1) AS volt
        FROM power_meter
        WHERE DATE(timestamp) BETWEEN DATE(?) AND DATE(?)
        GROUP BY DATE(timestamp)
        ORDER BY date;
      `;
      params = [startDate, endDate];
      response.message = `Data dari ${startDate} hingga ${endDate} berhasil diambil`;
    }

    // ✅ 4. Ada endDate tapi tidak ada startDate
    else if (!startDate && endDate) {
      await connection.release();
      return res.status(400).json({
        status: "failed",
        message: "Parameter 'startDate' wajib diisi jika 'endDate' dikirim",
        data: [],
      });
    }

    // ✅ Eksekusi query
    const [rows] = await connection.execute(sql, params);
    await connection.release();

    response.data = formatRowsToJakartaTime(rows);
    res.json(response);
  } catch (error) {
    console.error("Error fetching data from database:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = { getVoltData };
