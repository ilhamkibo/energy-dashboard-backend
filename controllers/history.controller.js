const db = require("../config/db.config");
const { formatRowsToJakartaTime } = require("../utils/formatDate");

async function getHistoryData(req, res) {
  const { startDate, endDate } = req.query;

  const response = {
    status: "success",
    message: "",
    data: [],
    label: "History Data",
  };

  let sqlPower = "";
  let sqlTemp = "";
  let params = [];

  try {
    // =============================
    // 1️⃣ Kondisi tanpa parameter (hari ini per jam)
    // =============================
    if (!startDate && !endDate) {
      sqlPower = `
        SELECT 
          DATE_FORMAT(timestamp, '%H:00:00') AS time_label,
          MAX(freq) AS freq,
          MAX(kva) AS kva,
          MAX(volt1) AS volt,
          MAX(amp1) AS amp,
          MAX(kw) AS watt,
          DATE_FORMAT(timestamp, '%Y-%m-%d') AS date
        FROM power_meter
        WHERE DATE(timestamp) = CURDATE()
        GROUP BY time_label, date
        ORDER BY time_label;
      `;

      sqlTemp = `
        SELECT 
          DATE_FORMAT(timestamp, '%H:00:00') AS time_label,
          AVG(temp) AS temp,
          DATE_FORMAT(timestamp, '%Y-%m-%d') AS date
        FROM temp_control
        WHERE DATE(timestamp) = CURDATE()
        GROUP BY time_label, date
        ORDER BY time_label;
      `;

      response.message = "Data hari ini berhasil diambil";
    }

    // =============================
    // 2️⃣ startDate saja (per jam di hari itu)
    // =============================
    else if (startDate && !endDate) {
      sqlPower = `
        SELECT 
          DATE_FORMAT(timestamp, '%H:00:00') AS time_label,
          MAX(freq) AS freq,
          MAX(kva) AS kva,
          MAX(volt1) AS volt,
          MAX(amp1) AS amp,
          MAX(kw) AS watt,
          DATE_FORMAT(timestamp, '%Y-%m-%d') AS date
        FROM power_meter
        WHERE DATE(timestamp) = DATE(?)
        GROUP BY time_label, date
        ORDER BY time_label;
      `;

      sqlTemp = `
        SELECT 
          DATE_FORMAT(timestamp, '%H:00:00') AS time_label,
          AVG(temp) AS temp,
          DATE_FORMAT(timestamp, '%Y-%m-%d') AS date
        FROM temp_control
        WHERE DATE(timestamp) = DATE(?)
        GROUP BY time_label, date
        ORDER BY time_label;
      `;

      params = [startDate];
      response.message = `Data pada tanggal ${startDate} berhasil diambil`;
    }

    // =============================
    // 3️⃣ startDate & endDate (per hari)
    // =============================
    else if (startDate && endDate) {
      sqlPower = `
        SELECT 
          DATE(timestamp) AS date,
          MAX(freq) AS freq,
          MAX(kva) AS kva,
          MAX(volt1) AS volt,
          MAX(amp1) AS amp,
          MAX(kw) AS watt
        FROM power_meter
        WHERE DATE(timestamp) BETWEEN DATE(?) AND DATE(?)
        GROUP BY DATE(timestamp)
        ORDER BY date;
      `;

      sqlTemp = `
        SELECT 
          DATE(timestamp) AS date,
          AVG(temp) AS temp
        FROM temp_control
        WHERE DATE(timestamp) BETWEEN DATE(?) AND DATE(?)
        GROUP BY DATE(timestamp)
        ORDER BY date;
      `;

      params = [startDate, endDate];
      response.message = `Data dari ${startDate} hingga ${endDate} berhasil diambil`;
    }

    // =============================
    // 4️⃣ endDate tanpa startDate
    // =============================
    else if (!startDate && endDate) {
      return res.status(400).json({
        status: "failed",
        message: "Parameter 'startDate' wajib diisi jika 'endDate' dikirim",
        data: [],
      });
    }

    // =============================
    // Eksekusi query secara paralel (lebih cepat)
    // =============================
    const connection = await db.getConnection();

    const [powerRows, tempRows] = await Promise.all([
      connection.execute(sqlPower, params),
      connection.execute(sqlTemp, params),
    ]);

    await connection.release();

    const formattedPower = formatRowsToJakartaTime(powerRows[0]);
    const formattedTemp = formatRowsToJakartaTime(tempRows[0]);

    // =============================
    // Gabungkan hasil berdasarkan tanggal & waktu
    // =============================
    const merged = formattedPower.map((p) => {
      const t = formattedTemp.find(
        (temp) =>
          temp.date === p.date &&
          (p.time_label ? temp.time_label === p.time_label : true)
      );
      return {
        ...p,
        temp: t ? t.temp : null,
      };
    });

    // =============================
    // Transformasi data jadi group-by parameter
    // =============================
    const volt = merged.map((item) => ({
      value: item.volt,
      ...(item.time_label ? { time_label: item.time_label } : {}),
      ...(item.date ? { date: item.date } : {}),
    }));

    const kva = merged.map((item) => ({
      value: item.kva,
      ...(item.time_label ? { time_label: item.time_label } : {}),
      ...(item.date ? { date: item.date } : {}),
    }));

    const watt = merged.map((item) => ({
      value: item.watt,
      ...(item.time_label ? { time_label: item.time_label } : {}),
      ...(item.date ? { date: item.date } : {}),
    }));

    const freq = merged.map((item) => ({
      value: item.freq,
      ...(item.time_label ? { time_label: item.time_label } : {}),
      ...(item.date ? { date: item.date } : {}),
    }));

    const temp = merged.map((item) => ({
      value: item.temp,
      ...(item.time_label ? { time_label: item.time_label } : {}),
      ...(item.date ? { date: item.date } : {}),
    }));

    const ampere = merged.map((item) => ({
      value: item.amp,
      ...(item.time_label ? { time_label: item.time_label } : {}),
      ...(item.date ? { date: item.date } : {}),
    }));

    response.data = [
      { volt },
      { kva },
      { watt },
      { freq },
      { temp },
      { ampere },
    ];

    return res.json(response);
  } catch (error) {
    console.error("Error fetching data from database:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = { getHistoryData };
