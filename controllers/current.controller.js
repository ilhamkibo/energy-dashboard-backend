const db = require("../config/db.config");
const { formatRowsToJakartaTime } = require("../utils/formatDate");

async function getCurrentData(req, res) {
  try {
    const connection = await db.getConnection();
    const { startDate, endDate } = req.query;
    const response = {
      status: "success",
      message: "",
      data: [],
      label: "Current (Ampere)",
    };

    let sql = "";
    let params = [];

    // ✅ 1. Tidak ada parameter (ambil data hari ini per jam)
    if (!startDate && !endDate) {
      sql = `
        SELECT 
          DATE_FORMAT(timestamp, '%H:00:00') AS time_label,
          MAX(amp1) AS amp,
          DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS date
        FROM power_meter
        WHERE DATE(timestamp) = CURDATE()
        GROUP BY DATE_FORMAT(timestamp, '%H:00:00')
        ORDER BY DATE_FORMAT(timestamp, '%H:00:00');
      `;
      response.message = "Data arus (Ampere) hari ini berhasil diambil";
    }

    // ✅ 2. Ada startDate tapi tidak ada endDate (ambil data per jam pada tanggal tsb)
    else if (startDate && !endDate) {
      sql = `
        SELECT 
          DATE_FORMAT(timestamp, '%H:00:00') AS time_label,
          MAX(amp1) AS amp,
          DATE_FORMAT(DATE(?), '%Y-%m-%d') AS date
        FROM power_meter
        WHERE DATE(timestamp) = DATE(?)
        GROUP BY DATE_FORMAT(timestamp, '%H:00:00')
        ORDER BY DATE_FORMAT(timestamp, '%H:00:00');
      `;
      params = [startDate, startDate];
      response.message = `Data arus pada tanggal ${startDate} berhasil diambil`;
    }

    // ✅ 3. Ada startDate dan endDate (ambil data maksimum per hari di rentang tsb)
    else if (startDate && endDate) {
      sql = `
        SELECT 
          DATE(timestamp) AS date,
          MAX(amp1) AS amp
        FROM power_meter
        WHERE DATE(timestamp) BETWEEN DATE(?) AND DATE(?)
        GROUP BY DATE(timestamp)
        ORDER BY DATE(timestamp);
      `;
      params = [startDate, endDate];
      response.message = `Data arus dari ${startDate} hingga ${endDate} berhasil diambil`;
    }

    // ✅ 4. Ada endDate tanpa startDate (tidak valid)
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

module.exports = { getCurrentData };
