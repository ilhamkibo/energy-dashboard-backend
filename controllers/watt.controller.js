const db = require("../config/db.config");
const { formatRowsToJakartaTime } = require("../utils/formatDate");

async function getWattData(req, res) {
  try {
    const connection = await db.getConnection();
    const { startDate, endDate } = req.query;

    const response = {
      status: "success",
      message: "",
      data: [],
      label: "Watt",
    };

    let sql;
    let params = [];

    // ✅ 1. Tidak ada query param (ambil data hari ini per jam)
    if (!startDate && !endDate) {
      sql = `
        SELECT 
          DATE_FORMAT(timestamp, '%H:00:00') AS time_label,
          MAX(kw) AS value,
          DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS date
        FROM power_meter
        WHERE DATE(timestamp) = CURDATE()
          AND no_device = 1
        GROUP BY DATE_FORMAT(timestamp, '%H:00:00')
        ORDER BY DATE_FORMAT(timestamp, '%H:00:00');
      `;
      response.message = "Data watt hari ini berhasil diambil";
    }

    // ✅ 2. Ada startDate tapi tidak ada endDate → ambil data hari itu per jam
    else if (startDate && !endDate) {
      sql = `
        SELECT 
          DATE_FORMAT(timestamp, '%H:00:00') AS time_label,
          MAX(kw) AS value,
          DATE_FORMAT(DATE(?), '%Y-%m-%d') AS date
        FROM power_meter
        WHERE DATE(timestamp) = DATE(?)
          AND no_device = 1
        GROUP BY DATE_FORMAT(timestamp, '%H:00:00')
        ORDER BY DATE_FORMAT(timestamp, '%H:00:00');
      `;
      params = [startDate, startDate];
      response.message = `Data watt pada tanggal ${startDate} berhasil diambil`;
    }

    // ✅ 3. Ada startDate dan endDate → ambil data total harian
    else if (startDate && endDate) {
      sql = `
        SELECT 
          DATE(timestamp) AS date,
          MAX(kw) AS value
        FROM power_meter
        WHERE DATE(timestamp) BETWEEN DATE(?) AND DATE(?)
          AND no_device = 1
        GROUP BY DATE(timestamp)
        ORDER BY DATE(timestamp);
      `;
      params = [startDate, endDate];
      response.message = `Data watt dari ${startDate} hingga ${endDate} berhasil diambil`;
    }

    // ✅ 4. Hanya endDate → invalid
    else if (!startDate && endDate) {
      await connection.release();
      return res.status(400).json({
        status: "failed",
        message: "Parameter 'startDate' wajib diisi jika 'endDate' dikirim",
        data: [],
      });
    }

    // Eksekusi query
    const [rows] = await connection.execute(sql, params);
    await connection.release();

    // Format tanggal agar sesuai zona waktu
    const formattedRows = formatRowsToJakartaTime(rows);

    response.data = formattedRows;
    res.json(response);
  } catch (error) {
    console.error("Error fetching watt data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = { getWattData };
