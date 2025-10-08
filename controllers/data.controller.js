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
          DATE_FORMAT(CONVERT_TZ(timestamp, '+00:00', '+07:00'), '%H:00:00') AS time_label,
          MAX(volt1) AS volt1,
          DATE_FORMAT(CONVERT_TZ(timestamp, '+00:00', '+07:00'), '%Y-%m-%d') AS date
        FROM power_meter
        WHERE DATE(CONVERT_TZ(timestamp, '+00:00', '+07:00')) = CURDATE()
        GROUP BY DATE_FORMAT(CONVERT_TZ(timestamp, '+00:00', '+07:00'), '%H:00:00')
        ORDER BY time_label;
      `;
      response.message = "Data hari ini berhasil diambil";
    }

    // ✅ 2. Ada startDate tapi tidak ada endDate → ambil data pada hari itu
    else if (startDate && !endDate) {
      sql = `
        SELECT 
          DATE_FORMAT(CONVERT_TZ(timestamp, '+00:00', '+07:00'), '%H:00:00') AS time_label,
          MAX(volt1) AS volt1,
          DATE_FORMAT(CONVERT_TZ(timestamp, '+00:00', '+07:00'), '%Y-%m-%d') AS date
        FROM power_meter
        WHERE DATE(CONVERT_TZ(timestamp, '+00:00', '+07:00')) = DATE(?)
        GROUP BY DATE_FORMAT(CONVERT_TZ(timestamp, '+00:00', '+07:00'), '%H:00:00')
        ORDER BY time_label;
      `;
      params = [startDate];
      response.message = `Data pada tanggal ${startDate} berhasil diambil`;
    }

    // ✅ 3. Ada startDate & endDate → ambil data tertinggi per hari
    else if (startDate && endDate) {
      sql = `
        SELECT 
          DATE(CONVERT_TZ(timestamp, '+00:00', '+07:00')) AS date,
          MAX(volt1) AS volt1
        FROM power_meter
        WHERE DATE(CONVERT_TZ(timestamp, '+00:00', '+07:00')) BETWEEN DATE(?) AND DATE(?)
        GROUP BY DATE(CONVERT_TZ(timestamp, '+00:00', '+07:00'))
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

// async function getVoltData(req, res) {
//   try {
//     const connection = await db.getConnection();
//     const device = req.query.device;
//     let response, sql;
//     let params = [];

//     response = {
//       status: "success",
//       data: {},
//       label:
//         device == "volt1" || device == "volt2" || device == "volt3"
//           ? ["Device 1", "Device 2", "Device 3"]
//           : ["Volt 1", "Volt 2", "Volt 3"],
//     };

//     if (req.query.endDate) {
//       const startDate = req.query.startDate;
//       const endDate = req.query.endDate;
//       if (device == "volt1" || device == "volt2" || device == "volt3") {
//         sql = `
//           SELECT
//             d1.timestamp AS timestamp,
//             COALESCE(d1.value1, 0) AS value1,
//             COALESCE(d2.value2, 0) AS value2,
//             COALESCE(d3.value3, 0) AS value3
//           FROM
//             (SELECT
//               DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
//               AVG(${device}) AS value1
//             FROM power_meter
//             WHERE DATE(timestamp) BETWEEN ? AND ? AND no_device = 1
//             GROUP BY DATE(timestamp)
//             ORDER BY timestamp DESC
//             LIMIT 250) AS d1
//           LEFT JOIN
//             (SELECT
//               DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
//               AVG(${device}) AS value2
//             FROM power_meter
//             WHERE DATE(timestamp) BETWEEN ? AND ? AND no_device = 2
//             GROUP BY DATE(timestamp)
//             ORDER BY timestamp DESC
//             LIMIT 250) AS d2
//             ON d1.timestamp = d2.timestamp
//           LEFT JOIN
//             (SELECT
//               DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
//               AVG(${device}) AS value3
//             FROM power_meter
//             WHERE DATE(timestamp) BETWEEN ? AND ? AND no_device = 3
//             GROUP BY DATE(timestamp)
//             ORDER BY timestamp DESC
//             LIMIT 250) AS d3
//             ON d1.timestamp = d3.timestamp
//           ORDER BY d1.timestamp;
//         `;
//         params = [startDate, endDate, startDate, endDate, startDate, endDate];
//       } else {
//         sql = `
//           SELECT * FROM (
//             SELECT
//               DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
//               AVG(volt3) AS value3,
//               AVG(volt2) AS value2,
//               AVG(volt1) AS value1
//             FROM power_meter
//             WHERE DATE(timestamp) BETWEEN ? AND ?
//             ${device ? "AND no_device = ?" : ""}
//             GROUP BY DATE(timestamp)
//             ORDER BY timestamp DESC
//             LIMIT 250
//           ) AS subquery
//           ORDER BY timestamp ASC;
//         `;
//         params = [startDate, endDate];
//         if (device) params.push(device);
//       }
//     } else {
//       if (req.query.date === "month") {
//         // Query untuk mendapatkan rata-rata harian untuk bulan ini
//         if (device == "volt1" || device == "volt2" || device == "volt3") {
//           sql = `
//             SELECT
//               d1.timestamp AS timestamp,
//               COALESCE(d1.value1, 0) AS value1,
//               COALESCE(d2.value2, 0) AS value2,
//               COALESCE(d3.value3, 0) AS value3
//             FROM
//               (SELECT
//                 DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
//                 AVG(${device}) AS value1
//               FROM power_meter
//               WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE()) AND no_device = 1
//               GROUP BY DATE(timestamp)
//               ORDER BY timestamp DESC) AS d1
//             LEFT JOIN
//               (SELECT
//                 DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
//                 AVG(${device}) AS value2
//               FROM power_meter
//               WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE()) AND no_device = 2
//               GROUP BY DATE(timestamp)
//               ORDER BY timestamp DESC) AS d2
//               ON d1.timestamp = d2.timestamp
//             LEFT JOIN
//               (SELECT
//                 DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
//                 AVG(${device}) AS value3
//               FROM power_meter
//               WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE()) AND no_device = 3
//               GROUP BY DATE(timestamp)
//               ORDER BY timestamp DESC) AS d3
//               ON d1.timestamp = d3.timestamp
//             ORDER BY d1.timestamp;
//           `;
//         } else {
//           sql = `
//           SELECT * FROM (
//             SELECT
//               DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
//               AVG(volt3) AS value3,
//               AVG(volt2) AS value2,
//               AVG(volt1) AS value1
//             FROM power_meter
//             WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE())
//             ${device ? "AND no_device = ?" : ""}
//             GROUP BY DATE(timestamp)
//             ORDER BY timestamp DESC
//             LIMIT 250
//           ) AS subquery
//           ORDER BY timestamp ASC;
//           `;
//           if (device) params.push(device);
//         }
//       } else if (req.query.date === "year") {
//         // Query untuk mendapatkan rata-rata bulanan untuk tahun ini
//         if (device == "volt1" || device == "volt2" || device == "volt3") {
//           sql = `
//             SELECT
//               d1.timestamp AS timestamp,
//               COALESCE(d1.value1, 0) AS value1,
//               COALESCE(d2.value2, 0) AS value2,
//               COALESCE(d3.value3, 0) AS value3
//             FROM
//               (SELECT
//                 DATE_FORMAT(timestamp, '%Y-%m') AS timestamp,
//                 AVG(${device}) AS value1
//               FROM power_meter
//               WHERE YEAR(timestamp) = YEAR(CURDATE()) AND no_device = 1
//               GROUP BY YEAR(timestamp), MONTH(timestamp)
//               ORDER BY timestamp DESC) AS d1
//             LEFT JOIN
//               (SELECT
//                 DATE_FORMAT(timestamp, '%Y-%m') AS timestamp,
//                 AVG(${device}) AS value2
//               FROM power_meter
//               WHERE YEAR(timestamp) = YEAR(CURDATE()) AND no_device = 2
//               GROUP BY YEAR(timestamp), MONTH(timestamp)
//               ORDER BY timestamp DESC) AS d2
//               ON d1.timestamp = d2.timestamp
//             LEFT JOIN
//               (SELECT
//                 DATE_FORMAT(timestamp, '%Y-%m') AS timestamp,
//                 AVG(${device}) AS value3
//               FROM power_meter
//               WHERE YEAR(timestamp) = YEAR(CURDATE()) AND no_device = 3
//               GROUP BY YEAR(timestamp), MONTH(timestamp)
//               ORDER BY timestamp DESC) AS d3
//               ON d1.timestamp = d3.timestamp
//             ORDER BY d1.timestamp;
//           `;
//         } else {
//           sql = `
//           SELECT * FROM (
//             SELECT
//               DATE_FORMAT(timestamp, '%Y-%m') AS timestamp,
//               AVG(volt3) AS value3,
//               AVG(volt2) AS value2,
//               AVG(volt1) AS value1
//             FROM power_meter
//             WHERE YEAR(timestamp) = YEAR(CURDATE())
//             ${device ? "AND no_device = ?" : ""}
//             GROUP BY YEAR(timestamp), MONTH(timestamp)
//             ORDER BY timestamp DESC
//             LIMIT 12
//           ) AS subquery
//           ORDER BY timestamp ASC;
//           `;
//           if (device) params.push(device);
//         }
//       } else {
//         // Default: Query untuk mendapatkan data hari ini
//         if (device == "volt1" || device == "volt2" || device == "volt3") {
//           sql = `
//             SELECT
//               COALESCE(d1.${device}, 0) AS value1,
//               COALESCE(d2.${device}, 0) AS value2,
//               COALESCE(d3.${device}, 0) AS value3,
//               COALESCE(d1.timestamp, d2.timestamp, d3.timestamp) AS timestamp
//             FROM
//               (SELECT ${device}, DATE_FORMAT(timestamp, '%H:%i:%s') as timestamp FROM power_meter WHERE no_device = 1 ORDER BY id DESC LIMIT 250) AS d1
//             LEFT JOIN
//               (SELECT ${device}, DATE_FORMAT(timestamp, '%H:%i:%s') as timestamp FROM power_meter WHERE no_device = 2 ORDER BY id DESC LIMIT 250) AS d2
//             ON d1.timestamp = d2.timestamp
//             LEFT JOIN
//               (SELECT ${device}, DATE_FORMAT(timestamp, '%H:%i:%s') as timestamp FROM power_meter WHERE no_device = 3 ORDER BY id DESC LIMIT 250) AS d3
//             ON d1.timestamp = d3.timestamp
//             ORDER BY timestamp;
//           `;
//         } else {
//           sql = `
//           SELECT *
//           FROM (
//               SELECT volt3 as value3, volt2 as value2, volt1 as value1, DATE_FORMAT(timestamp, '%H:%i:%s') AS timestamp
//               FROM power_meter
//               WHERE DATE(timestamp) = CURDATE()
//               ${device ? "AND no_device = ?" : ""}
//               ORDER BY timestamp DESC
//               LIMIT 250
//           ) AS subquery
//           ORDER BY timestamp ASC;
//           `;
//           if (device) params.push(device);
//         }
//       }
//     }

//     const [result] = await connection.execute(sql, params);
//     response.data = result;
//     await connection.release();

//     res.json(response);
//   } catch (error) {
//     console.error("Error fetching data from database:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// }

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
          MAX(amp1) AS amp1,
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
          MAX(amp1) AS amp1,
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
          MAX(amp1) AS amp1
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

// async function getCurrentData(req, res) {
//   try {
//     const connection = await db.getConnection();
//     const device = req.query.device;
//     let response, sql;
//     let params = [];

//     response = {
//       status: "success",
//       data: {},
//       label:
//         device == "amp1" || device == "amp2" || device == "amp3"
//           ? ["Device 1", "Device 2", "Device 3"]
//           : ["Current 1", "Current 2", "Current 3"],
//     };

//     if (req.query.endDate) {
//       const startDate = req.query.startDate;
//       const endDate = req.query.endDate;

//       if (device == "amp1" || device == "amp2" || device == "amp3") {
//         sql = `
//           SELECT
//             d1.timestamp AS timestamp,
//             COALESCE(d1.value1, 0) AS value1,
//             COALESCE(d2.value2, 0) AS value2,
//             COALESCE(d3.value3, 0) AS value3
//           FROM
//             (SELECT
//               DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
//               AVG(${device}) AS value1
//             FROM power_meter
//             WHERE DATE(timestamp) BETWEEN ? AND ? AND no_device = 1
//             GROUP BY DATE(timestamp)
//             ORDER BY timestamp DESC
//             LIMIT 250) AS d1
//           LEFT JOIN
//             (SELECT
//               DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
//               AVG(${device}) AS value2
//             FROM power_meter
//             WHERE DATE(timestamp) BETWEEN ? AND ? AND no_device = 2
//             GROUP BY DATE(timestamp)
//             ORDER BY timestamp DESC
//             LIMIT 250) AS d2
//             ON d1.timestamp = d2.timestamp
//           LEFT JOIN
//             (SELECT
//               DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
//               AVG(${device}) AS value3
//             FROM power_meter
//             WHERE DATE(timestamp) BETWEEN ? AND ? AND no_device = 3
//             GROUP BY DATE(timestamp)
//             ORDER BY timestamp DESC
//             LIMIT 250) AS d3
//             ON d1.timestamp = d3.timestamp
//           ORDER BY d1.timestamp;
//         `;
//         params = [startDate, endDate, startDate, endDate, startDate, endDate];
//       } else {
//         sql = `
//           SELECT * FROM (
//             SELECT
//               DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
//               AVG(amp3) AS value3,
//               AVG(amp2) AS value2,
//               AVG(amp1) AS value1
//             FROM power_meter
//             WHERE DATE(timestamp) BETWEEN ? AND ?
//             ${device ? "AND no_device = ?" : ""}
//             GROUP BY DATE(timestamp)
//             ORDER BY timestamp DESC
//             LIMIT 250
//           ) AS subquery
//           ORDER BY timestamp ASC;
//         `;
//         params = [startDate, endDate];
//         if (device) params.push(device);
//       }
//     } else {
//       if (req.query.date === "month") {
//         // Query untuk mendapatkan rata-rata harian untuk bulan ini
//         if (device == "amp1" || device == "amp2" || device == "amp3") {
//           sql = `
//             SELECT
//               d1.timestamp AS timestamp,
//               COALESCE(d1.value1, 0) AS value1,
//               COALESCE(d2.value2, 0) AS value2,
//               COALESCE(d3.value3, 0) AS value3
//             FROM
//               (SELECT
//                 DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
//                 AVG(${device}) AS value1
//               FROM power_meter
//               WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE()) AND no_device = 1
//               GROUP BY DATE(timestamp)
//               ORDER BY timestamp DESC) AS d1
//             LEFT JOIN
//               (SELECT
//                 DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
//                 AVG(${device}) AS value2
//               FROM power_meter
//               WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE()) AND no_device = 2
//               GROUP BY DATE(timestamp)
//               ORDER BY timestamp DESC) AS d2
//               ON d1.timestamp = d2.timestamp
//             LEFT JOIN
//               (SELECT
//                 DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
//                 AVG(${device}) AS value3
//               FROM power_meter
//               WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE()) AND no_device = 3
//               GROUP BY DATE(timestamp)
//               ORDER BY timestamp DESC) AS d3
//               ON d1.timestamp = d3.timestamp
//             ORDER BY d1.timestamp;
//           `;
//         } else {
//           sql = `
//             SELECT * FROM (
//               SELECT
//                 DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
//                 AVG(amp3) AS value3,
//                 AVG(amp2) AS value2,
//                 AVG(amp1) AS value1
//               FROM power_meter
//               WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE())
//               ${device ? "AND no_device = ?" : ""}
//               GROUP BY DATE(timestamp)
//               ORDER BY timestamp DESC
//             ) AS subquery
//             ORDER BY timestamp ASC;
//           `;
//           if (device) params.push(device);
//         }
//       } else if (req.query.date === "year") {
//         // Query untuk mendapatkan rata-rata bulanan untuk tahun ini
//         if (device == "amp1" || device == "amp2" || device == "amp3") {
//           sql = `
//             SELECT
//               d1.timestamp AS timestamp,
//               COALESCE(d1.value1, 0) AS value1,
//               COALESCE(d2.value2, 0) AS value2,
//               COALESCE(d3.value3, 0) AS value3
//             FROM
//               (SELECT
//                 DATE_FORMAT(timestamp, '%Y-%m') AS timestamp,
//                 AVG(${device}) AS value1
//               FROM power_meter
//               WHERE YEAR(timestamp) = YEAR(CURDATE()) AND no_device = 1
//               GROUP BY YEAR(timestamp), MONTH(timestamp)
//               ORDER BY timestamp DESC) AS d1
//             LEFT JOIN
//               (SELECT
//                 DATE_FORMAT(timestamp, '%Y-%m') AS timestamp,
//                 AVG(${device}) AS value2
//               FROM power_meter
//               WHERE YEAR(timestamp) = YEAR(CURDATE()) AND no_device = 2
//               GROUP BY YEAR(timestamp), MONTH(timestamp)
//               ORDER BY timestamp DESC) AS d2
//               ON d1.timestamp = d2.timestamp
//             LEFT JOIN
//               (SELECT
//                 DATE_FORMAT(timestamp, '%Y-%m') AS timestamp,
//                 AVG(${device}) AS value3
//               FROM power_meter
//               WHERE YEAR(timestamp) = YEAR(CURDATE()) AND no_device = 3
//               GROUP BY YEAR(timestamp), MONTH(timestamp)
//               ORDER BY timestamp DESC) AS d3
//               ON d1.timestamp = d3.timestamp
//             ORDER BY d1.timestamp;
//           `;
//         } else {
//           sql = `
//             SELECT * FROM (
//               SELECT
//                 DATE_FORMAT(timestamp, '%Y-%m') AS timestamp,
//                 AVG(amp3) AS value3,
//                 AVG(amp2) AS value2,
//                 AVG(amp1) AS value1
//               FROM power_meter
//               WHERE YEAR(timestamp) = YEAR(CURDATE())
//               ${device ? "AND no_device = ?" : ""}
//               GROUP BY YEAR(timestamp), MONTH(timestamp)
//               ORDER BY timestamp DESC
//               LIMIT 12
//             ) AS subquery
//             ORDER BY timestamp ASC;
//           `;
//           if (device) params.push(device);
//         }
//       } else {
//         // Default: Query untuk mendapatkan data hari ini
//         if (device == "amp1" || device == "amp2" || device == "amp3") {
//           sql = `
//             SELECT
//               COALESCE(d1.${device}, 0) AS value1,
//               COALESCE(d2.${device}, 0) AS value2,
//               COALESCE(d3.${device}, 0) AS value3,
//               COALESCE(d1.timestamp, d2.timestamp, d3.timestamp) AS timestamp
//             FROM
//               (SELECT ${device}, DATE_FORMAT(timestamp, '%H:%i:%s') as timestamp FROM power_meter WHERE no_device = 1 ORDER BY id DESC LIMIT 250) AS d1
//             LEFT JOIN
//               (SELECT ${device}, DATE_FORMAT(timestamp, '%H:%i:%s') as timestamp FROM power_meter WHERE no_device = 2 ORDER BY id DESC LIMIT 250) AS d2
//             ON d1.timestamp = d2.timestamp
//             LEFT JOIN
//               (SELECT ${device}, DATE_FORMAT(timestamp, '%H:%i:%s') as timestamp FROM power_meter WHERE no_device = 3 ORDER BY id DESC LIMIT 250) AS d3
//             ON d1.timestamp = d3.timestamp

//             ORDER BY timestamp DESC;
//           `;
//         } else {
//           sql = `
//             SELECT *
//             FROM (
//               SELECT amp3 as value3, amp2 as value2, amp1 as value1, DATE_FORMAT(timestamp, '%H:%i:%s') AS timestamp
//               FROM power_meter
//               WHERE DATE(timestamp) = CURDATE()
//               ${device ? "AND no_device = ?" : ""}
//               ORDER BY timestamp DESC
//               LIMIT 250
//             ) AS subquery
//             ORDER BY timestamp ASC;
//           `;
//           if (device) params.push(device);
//         }
//       }
//     }

//     const [result] = await connection.execute(sql, params);
//     response.data = result;
//     await connection.release();

//     res.json(response);
//   } catch (error) {
//     console.error("Error fetching data from database:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// }

async function getWattData(req, res) {
  try {
    const connection = await db.getConnection();
    const device = req.query.device;
    let sql, totalQuery, avgQuery, response;
    let params = [];

    response = {
      status: "success",
      data: {},
      summary: {
        average: {},
        total: {},
      },
      label: device == "all" ? ["Device 1", "Device 2", "Device 3"] : ["Watt"],
    };

    if (req.query.endDate) {
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;

      if (device == "all") {
        sql = `
          SELECT
            COALESCE(d1.kw, 0) AS value1,
            COALESCE(d2.kw, 0) AS value2,
            COALESCE(d3.kw, 0) AS value3,
            COALESCE(d1.timestamp, d2.timestamp, d3.timestamp) AS timestamp
          FROM
            (SELECT sum(kw) as kw, DATE_FORMAT(timestamp, '%Y-%m-%d') as timestamp FROM power_meter WHERE DATE(timestamp) BETWEEN ? AND ? and no_device = 1 GROUP BY DATE(timestamp)) AS d1
          LEFT JOIN
            (SELECT sum(kw) as kw, DATE_FORMAT(timestamp, '%Y-%m-%d') as timestamp FROM power_meter WHERE DATE(timestamp) BETWEEN ? AND ? and no_device = 2 GROUP BY DATE(timestamp)) AS d2
          ON d1.timestamp = d2.timestamp
          LEFT JOIN
            (SELECT sum(kw) as kw, DATE_FORMAT(timestamp, '%Y-%m-%d') as timestamp FROM power_meter WHERE DATE(timestamp) BETWEEN ? AND ? and no_device = 3 GROUP BY DATE(timestamp)) AS d3
          ON d1.timestamp = d3.timestamp
          ORDER BY timestamp ASC;
          `;

        totalQuery = `
        SELECT
          (SELECT SUM(kw) as kw FROM power_meter WHERE DATE(timestamp) BETWEEN ? AND ? and no_device = 1) AS value1,
          (SELECT SUM(kw) as kw FROM power_meter WHERE DATE(timestamp) BETWEEN ? AND ? and no_device = 2) AS value2,
          (SELECT SUM(kw) as kw FROM power_meter WHERE DATE(timestamp) BETWEEN ? AND ? and no_device = 3) AS value3
        `;

        avgQuery = `
        SELECT
          (SELECT AVG(kw) as kw FROM power_meter WHERE DATE(timestamp) BETWEEN ? AND ? and no_device = 1) AS value1,
          (SELECT AVG(kw) as kw FROM power_meter WHERE DATE(timestamp) BETWEEN ? AND ? and no_device = 2) AS value2,
          (SELECT AVG(kw) as kw FROM power_meter WHERE DATE(timestamp) BETWEEN ? AND ? and no_device = 3) AS value3
        `;

        params = [startDate, endDate, startDate, endDate, startDate, endDate];
      } else {
        sql = `
          SELECT * FROM (
            SELECT
              DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
              SUM(kw) AS value
            FROM power_meter
            WHERE DATE(timestamp) BETWEEN ? AND ?
            ${device ? "AND no_device = ?" : ""}
            GROUP BY DATE(timestamp)
            ORDER BY timestamp DESC
            LIMIT 250
          ) AS subquery
          ORDER BY timestamp ASC;
        `;

        avgQuery = `
          SELECT
            AVG(kW) AS value1
          FROM power_meter
          WHERE DATE(timestamp) BETWEEN ? AND ?
          ${device ? "AND no_device = ?" : ""}
        `;

        totalQuery = `
          SELECT
            SUM(kW) AS value1
          FROM power_meter
          WHERE DATE(timestamp) BETWEEN ? AND ?
          ${device ? "AND no_device = ?" : ""}
        `;

        params = [startDate, endDate];
        if (device) params.push(device);
      }
    } else {
      if (req.query.date === "month") {
        // Query untuk mendapatkan rata-rata harian untuk bulan ini
        if (device == "all") {
          sql = `
          SELECT
            COALESCE(d1.kw, 0) AS value1,
            COALESCE(d2.kw, 0) AS value2,
            COALESCE(d3.kw, 0) AS value3,
            COALESCE(d1.timestamp, d2.timestamp, d3.timestamp) AS timestamp
          FROM
            (SELECT sum(kw) as kw, DATE_FORMAT(timestamp, '%Y-%m-%d') as timestamp FROM power_meter WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE()) and no_device = 1 GROUP BY DATE(timestamp)) AS d1
          LEFT JOIN
            (SELECT sum(kw) as kw, DATE_FORMAT(timestamp, '%Y-%m-%d') as timestamp FROM power_meter WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE()) and no_device = 2 GROUP BY DATE(timestamp)) AS d2
          ON d1.timestamp = d2.timestamp
          LEFT JOIN
            (SELECT sum(kw) as kw, DATE_FORMAT(timestamp, '%Y-%m-%d') as timestamp FROM power_meter WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE()) and no_device = 3 GROUP BY DATE(timestamp)) AS d3
          ON d1.timestamp = d3.timestamp
          ORDER BY timestamp ASC;
          `;

          totalQuery = `
          SELECT
            (SELECT SUM(kw) as kw FROM power_meter WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE()) and no_device = 1) AS value1,
            (SELECT SUM(kw) as kw FROM power_meter WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE()) and no_device = 2) AS value2,
            (SELECT SUM(kw) as kw FROM power_meter WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE()) and no_device = 3) AS value3
          `;

          avgQuery = `
          SELECT
            (SELECT AVG(kw) as kw FROM power_meter WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE()) and no_device = 1) AS value1,
            (SELECT AVG(kw) as kw FROM power_meter WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE()) and no_device = 2) AS value2,
            (SELECT AVG(kw) as kw FROM power_meter WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE()) and no_device = 3) AS value3
          `;
        } else {
          sql = `
            SELECT * FROM (
              SELECT
                DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
                SUM(kw) AS value
              FROM power_meter
              WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE())
              ${device ? "AND no_device = ?" : ""}
              GROUP BY DATE(timestamp)
              ORDER BY timestamp DESC
            ) AS subquery
            ORDER BY timestamp ASC;
          `;

          totalQuery = `
            SELECT
              SUM(kW) AS value1
            FROM power_meter
            WHERE YEAR(timestamp) = YEAR(CURDATE()) AND MONTH(timestamp) = MONTH(CURDATE())
            ${device ? "AND no_device = ?" : ""}
          `;

          avgQuery = `
            SELECT
              AVG(kW) AS value1
            FROM power_meter
            WHERE YEAR(timestamp) = YEAR(CURDATE()) AND MONTH(timestamp) = MONTH(CURDATE())
            ${device ? "AND no_device = ?" : ""}
          `;
        }
        if (device) params.push(device);
      } else if (req.query.date === "year") {
        // Query untuk mendapatkan rata-rata bulanan untuk tahun ini
        if (device == "all") {
          sql = `
          SELECT
            COALESCE(d1.kw, 0) AS value1,
            COALESCE(d2.kw, 0) AS value2,
            COALESCE(d3.kw, 0) AS value3,
            COALESCE(d1.timestamp, d2.timestamp, d3.timestamp) AS timestamp
          FROM
            (SELECT sum(kw) as kw, DATE_FORMAT(timestamp, '%Y-%m') as timestamp FROM power_meter WHERE YEAR(timestamp) = YEAR(CURDATE()) and no_device = 1 GROUP BY YEAR(timestamp), MONTH(timestamp)) AS d1
          LEFT JOIN
            (SELECT sum(kw) as kw, DATE_FORMAT(timestamp, '%Y-%m') as timestamp FROM power_meter WHERE YEAR(timestamp) = YEAR(CURDATE()) and no_device = 2 GROUP BY YEAR(timestamp), MONTH(timestamp)) AS d2
          ON d1.timestamp = d2.timestamp
          LEFT JOIN
            (SELECT sum(kw) as kw, DATE_FORMAT(timestamp, '%Y-%m') as timestamp FROM power_meter WHERE YEAR(timestamp) = YEAR(CURDATE()) and no_device = 3 GROUP BY YEAR(timestamp), MONTH(timestamp)) AS d3
          ON d1.timestamp = d3.timestamp
          ORDER BY timestamp ASC;
          `;

          totalQuery = `
          SELECT
            (SELECT SUM(kw) as kw FROM power_meter WHERE YEAR(timestamp) = YEAR(CURDATE()) and no_device = 1) AS value1,
            (SELECT SUM(kw) as kw FROM power_meter WHERE YEAR(timestamp) = YEAR(CURDATE()) and no_device = 2) AS value2,
            (SELECT SUM(kw) as kw FROM power_meter WHERE YEAR(timestamp) = YEAR(CURDATE()) and no_device = 3) AS value3
          `;

          avgQuery = `
          SELECT
            (SELECT AVG(kw) as kw FROM power_meter WHERE YEAR(timestamp) = YEAR(CURDATE()) and no_device = 1) AS value1,
            (SELECT AVG(kw) as kw FROM power_meter WHERE YEAR(timestamp) = YEAR(CURDATE()) and no_device = 2) AS value2,
            (SELECT AVG(kw) as kw FROM power_meter WHERE YEAR(timestamp) = YEAR(CURDATE()) and no_device = 3) AS value3
          `;
        } else {
          sql = `
            SELECT * FROM (
              SELECT
                DATE_FORMAT(timestamp, '%Y-%m') AS timestamp,
                SUM(kw) AS value
              FROM power_meter
              WHERE YEAR(timestamp) = YEAR(CURDATE())
              ${device ? "AND no_device = ?" : ""}
              GROUP BY YEAR(timestamp), MONTH(timestamp)
              ORDER BY timestamp
              LIMIT 12
            ) AS subquery
            ORDER BY timestamp ASC;
          `;

          totalQuery = `
            SELECT
              SUM(kW) AS value1
            FROM power_meter
            WHERE YEAR(timestamp) = YEAR(CURDATE())
            ${device ? "AND no_device = ?" : ""}
          `;

          avgQuery = `
            SELECT
              AVG(kW) AS value1
            FROM power_meter
            WHERE YEAR(timestamp) = YEAR(CURDATE())
            ${device ? "AND no_device = ?" : ""}
          `;
        }
        if (device) params.push(device);
      } else {
        // Default: Query untuk mendapatkan data hari ini
        if (device == "all") {
          sql = `
          SELECT
            COALESCE(d1.kw, 0) AS value1,
            COALESCE(d2.kw, 0) AS value2,
            COALESCE(d3.kw, 0) AS value3,
            COALESCE(d1.timestamp, d2.timestamp, d3.timestamp) AS timestamp
          FROM
            (SELECT kw, DATE_FORMAT(timestamp, '%H:%i:%s') as timestamp FROM power_meter WHERE no_device = 1 ORDER BY timestamp DESC LIMIT 250) AS d1
          LEFT JOIN
            (SELECT kw, DATE_FORMAT(timestamp, '%H:%i:%s') as timestamp FROM power_meter WHERE no_device = 2 ORDER BY timestamp DESC LIMIT 250) AS d2
          ON d1.timestamp = d2.timestamp
          LEFT JOIN
            (SELECT kw, DATE_FORMAT(timestamp, '%H:%i:%s') as timestamp FROM power_meter WHERE no_device = 3 ORDER BY timestamp DESC LIMIT 250) AS d3
          ON d1.timestamp = d3.timestamp
          ORDER BY timestamp DESC;
          `;

          totalQuery = `
          SELECT
            (SELECT SUM(kw) as kw FROM power_meter WHERE DATE(timestamp) = CURDATE() and no_device = 1) AS value1,
            (SELECT SUM(kw) as kw FROM power_meter WHERE DATE(timestamp) = CURDATE() and no_device = 2) AS value2,
            (SELECT SUM(kw) as kw FROM power_meter WHERE DATE(timestamp) = CURDATE() and no_device = 3) AS value3
          `;

          avgQuery = `
          SELECT
            (SELECT AVG(kw) as kw FROM power_meter WHERE DATE(timestamp) = CURDATE() and no_device = 1) AS value1,
            (SELECT AVG(kw) as kw FROM power_meter WHERE DATE(timestamp) = CURDATE() and no_device = 2) AS value2,
            (SELECT AVG(kw) as kw FROM power_meter WHERE DATE(timestamp) = CURDATE() and no_device = 3) AS value3
          `;
        } else {
          sql = `
            SELECT * FROM (
              SELECT kw AS value, DATE_FORMAT(timestamp, '%H:%i:%s') AS timestamp
              FROM power_meter
              WHERE DATE(timestamp) = CURDATE()
              ${device ? "AND no_device = ?" : ""}
              ORDER BY timestamp DESC
              LIMIT 250
            ) AS subquery
            ORDER BY timestamp ASC;
          `;

          totalQuery = `
            SELECT
              SUM(kW) AS value1
            FROM power_meter
            WHERE DATE(timestamp) = CURDATE()
            ${device ? "AND no_device = ?" : ""}
          `;

          avgQuery = `
            SELECT
              AVG(kW) AS value1
            FROM power_meter
            WHERE DATE(timestamp) = CURDATE()
            ${device ? "AND no_device = ?" : ""}
          `;
        }
        if (device) params.push(device);
      }
    }

    // Eksekusi query utama
    const [result] = await connection.execute(sql, params);

    // Eksekusi query tambahan untuk summary
    const [totalResult] = await connection.execute(totalQuery, params);
    const [avgResult] = await connection.execute(avgQuery, params);

    // Transform the totalResult and avgResult to arrays of values
    const totalValues = [
      totalResult[0].value1,
      totalResult[0].value2,
      totalResult[0].value3,
    ];

    const averageValues = [
      avgResult[0].value1,
      avgResult[0].value2,
      avgResult[0].value3,
    ];

    // Mengatur data response
    response.data = result;
    response.summary.total = totalValues;
    response.summary.average = averageValues;

    await connection.release();

    res.json(response);
  } catch (error) {
    console.error("Error fetching data from database:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getKvaData(req, res) {
  try {
    const connection = await db.getConnection();
    const device = req.query.device;
    let sql, response;
    let params = [];

    response = {
      status: "success",
      data: {},
      label: device == "all" ? ["Device 1", "Device 2", "Device 3"] : ["KVA"],
    };

    if (req.query.endDate) {
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;

      if (device == "all") {
        sql = `
          SELECT
            COALESCE(d1.kva, 0) AS value1,
            COALESCE(d2.kva, 0) AS value2,
            COALESCE(d3.kva, 0) AS value3,
            COALESCE(d1.timestamp, d2.timestamp, d3.timestamp) AS timestamp
          FROM
            (SELECT sum(kva) as kva, DATE_FORMAT(timestamp, '%Y-%m-%d') as timestamp FROM power_meter WHERE DATE(timestamp) BETWEEN ? AND ? and no_device = 1 GROUP BY DATE(timestamp)) AS d1
          LEFT JOIN
            (SELECT sum(kva) as kva, DATE_FORMAT(timestamp, '%Y-%m-%d') as timestamp FROM power_meter WHERE DATE(timestamp) BETWEEN ? AND ? and no_device = 2 GROUP BY DATE(timestamp)) AS d2
          ON d1.timestamp = d2.timestamp
          LEFT JOIN
            (SELECT sum(kva) as kva, DATE_FORMAT(timestamp, '%Y-%m-%d') as timestamp FROM power_meter WHERE DATE(timestamp) BETWEEN ? AND ? and no_device = 3 GROUP BY DATE(timestamp)) AS d3
          ON d1.timestamp = d3.timestamp
          ORDER BY timestamp ASC;
          `;

        params = [startDate, endDate, startDate, endDate, startDate, endDate];
      } else {
        sql = `
          SELECT * FROM (
            SELECT
              DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
              sum(kva) AS value
            FROM power_meter
            WHERE DATE(timestamp) BETWEEN ? AND ?
            ${device ? "AND no_device = ?" : ""}
            GROUP BY DATE(timestamp)
            ORDER BY timestamp DESC
            LIMIT 250
          ) AS subquery
          ORDER BY timestamp ASC;
          `;

        params = [startDate, endDate];
        if (device) params.push(device);
      }
    } else {
      if (req.query.date === "month") {
        // Query untuk mendapatkan rata-rata harian untuk bulan ini
        if (device == "all") {
          sql = `
          SELECT
            COALESCE(d1.kva, 0) AS value1,
            COALESCE(d2.kva, 0) AS value2,
            COALESCE(d3.kva, 0) AS value3,
            COALESCE(d1.timestamp, d2.timestamp, d3.timestamp) AS timestamp
          FROM
            (SELECT sum(kva) as kva, DATE_FORMAT(timestamp, '%Y-%m-%d') as timestamp FROM power_meter WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE()) and no_device = 1 GROUP BY DATE(timestamp)) AS d1
          LEFT JOIN
            (SELECT sum(kva) as kva, DATE_FORMAT(timestamp, '%Y-%m-%d') as timestamp FROM power_meter WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE()) and no_device = 2 GROUP BY DATE(timestamp)) AS d2
          ON d1.timestamp = d2.timestamp
          LEFT JOIN
            (SELECT sum(kva) as kva, DATE_FORMAT(timestamp, '%Y-%m-%d') as timestamp FROM power_meter WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE()) and no_device = 3 GROUP BY DATE(timestamp)) AS d3
          ON d1.timestamp = d3.timestamp
          ORDER BY timestamp ASC;
          `;
        } else {
          sql = `
            select * from (SELECT
              DATE_FORMAT(timestamp, '%Y-%m-%d') as timestamp,
              AVG(kva) AS value
              FROM power_meter
              WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE())
              ${device ? "AND no_device = ?" : ""}
              GROUP BY DATE(timestamp)
              ORDER BY timestamp DESC) as subquery order by timestamp asc
          `;
          if (device) params.push(device);
        }
      } else if (req.query.date === "year") {
        // Query untuk mendapatkan rata-rata bulanan untuk tahun ini
        if (device == "all") {
          sql = `
          SELECT
            COALESCE(d1.kva, 0) AS value1,
            COALESCE(d2.kva, 0) AS value2,
            COALESCE(d3.kva, 0) AS value3,
            COALESCE(d1.timestamp, d2.timestamp, d3.timestamp) AS timestamp
          FROM
            (SELECT sum(kva) as kva, DATE_FORMAT(timestamp, '%Y-%m') as timestamp FROM power_meter WHERE YEAR(timestamp) = YEAR(CURDATE()) and no_device = 1 GROUP BY YEAR(timestamp), MONTH(timestamp)) AS d1
          LEFT JOIN
            (SELECT sum(kva) as kva, DATE_FORMAT(timestamp, '%Y-%m') as timestamp FROM power_meter WHERE YEAR(timestamp) = YEAR(CURDATE()) and no_device = 2 GROUP BY YEAR(timestamp), MONTH(timestamp)) AS d2
          ON d1.timestamp = d2.timestamp
          LEFT JOIN
            (SELECT sum(kva) as kva, DATE_FORMAT(timestamp, '%Y-%m') as timestamp FROM power_meter WHERE YEAR(timestamp) = YEAR(CURDATE()) and no_device = 3 GROUP BY YEAR(timestamp), MONTH(timestamp)) AS d3
          ON d1.timestamp = d3.timestamp
          ORDER BY timestamp ASC;
          `;
        } else {
          sql = `
            select * from (SELECT
              YEAR(timestamp) AS year,
              MONTH(timestamp) AS month,
              DATE_FORMAT(timestamp, '%Y-%m') as timestamp,
              AVG(kva) AS value
            FROM power_meter
            WHERE YEAR(timestamp) = YEAR(CURDATE())
            ${device ? "AND no_device = ?" : ""}
            GROUP BY YEAR(timestamp), MONTH(timestamp)
            ORDER BY year DESC, month DESC
            LIMIT 12) as subquery order by timestamp asc
          `;
          if (device) params.push(device);
        }
      } else {
        // Default: Query untuk mendapatkan data hari ini
        if (device == "all") {
          sql = `
          SELECT
            COALESCE(d1.kva, 0) AS value1,
            COALESCE(d2.kva, 0) AS value2,
            COALESCE(d3.kva, 0) AS value3,
            COALESCE(d1.timestamp, d2.timestamp, d3.timestamp) AS timestamp
          FROM
            (SELECT kva, DATE_FORMAT(timestamp, '%H:%i:%s') as timestamp FROM power_meter WHERE no_device = 1 ORDER BY timestamp DESC LIMIT 250) AS d1
          LEFT JOIN
            (SELECT kva, DATE_FORMAT(timestamp, '%H:%i:%s') as timestamp FROM power_meter WHERE no_device = 2 ORDER BY timestamp DESC LIMIT 250) AS d2
          ON d1.timestamp = d2.timestamp
          LEFT JOIN
            (SELECT kva, DATE_FORMAT(timestamp, '%H:%i:%s') as timestamp FROM power_meter WHERE no_device = 3 ORDER BY timestamp DESC LIMIT 250) AS d3
          ON d1.timestamp = d3.timestamp
          ORDER BY timestamp DESC;
          `;
        } else {
          sql = `
            select * from (SELECT kva as value, DATE_FORMAT(timestamp, '%H:%i:%s') as timestamp
            FROM power_meter
            WHERE DATE(timestamp) = CURDATE() ${
              device ? "AND no_device = ?" : ""
            } order by timestamp desc limit 250) as subquery order by timestamp asc
            
          `;
          if (device) params.push(device);
        }
      }
    }

    // Eksekusi query utama
    const [result] = await connection.execute(sql, params);

    // Mengatur data response
    response.data = result;

    await connection.release();

    res.json(response);
  } catch (error) {
    console.error("Error fetching data from database:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getFrequencyData(req, res) {
  try {
    const connection = await db.getConnection();
    const device = req.query.device;
    let sql, response;
    let params = [];

    response = {
      status: "success",
      data: {},
      label:
        device == "all" ? ["Device 1", "Device 2", "Device 3"] : ["Frequency"],
    };

    if (req.query.endDate) {
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;

      if (device == "all") {
        sql = `
        SELECT
          COALESCE(d1.freq, 0) AS value1,
          COALESCE(d2.freq, 0) AS value2,
          COALESCE(d3.freq, 0) AS value3,
          COALESCE(d1.timestamp, d2.timestamp, d3.timestamp) AS timestamp
        FROM
          (SELECT sum(freq) as freq, DATE_FORMAT(timestamp, '%Y-%m-%d') as timestamp FROM power_meter WHERE DATE(timestamp) BETWEEN ? AND ? and no_device = 1 GROUP BY DATE(timestamp)) AS d1
        LEFT JOIN
          (SELECT sum(freq) as freq, DATE_FORMAT(timestamp, '%Y-%m-%d') as timestamp FROM power_meter WHERE DATE(timestamp) BETWEEN ? AND ? and no_device = 2 GROUP BY DATE(timestamp)) AS d2
        ON d1.timestamp = d2.timestamp
        LEFT JOIN
          (SELECT sum(freq) as freq, DATE_FORMAT(timestamp, '%Y-%m-%d') as timestamp FROM power_meter WHERE DATE(timestamp) BETWEEN ? AND ? and no_device = 3 GROUP BY DATE(timestamp)) AS d3
        ON d1.timestamp = d3.timestamp
        ORDER BY timestamp ASC;
        `;

        params = [startDate, endDate, startDate, endDate, startDate, endDate];
      } else {
        sql = `
          SELECT * FROM (
            SELECT
              DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
              AVG(freq) AS value
            FROM power_meter
            WHERE DATE(timestamp) BETWEEN ? AND ?
            ${device ? "AND no_device = ?" : ""}
            GROUP BY DATE(timestamp)
            ORDER BY timestamp DESC
            LIMIT 250
          ) AS subquery
          ORDER BY timestamp ASC;
        `;
        params = [startDate, endDate];
        if (device) params.push(device);
      }
    } else {
      if (req.query.date === "month") {
        // Query untuk mendapatkan rata-rata harian untuk bulan ini
        if (device == "all") {
          sql = `
          SELECT
            COALESCE(d1.freq, 0) AS value1,
            COALESCE(d2.freq, 0) AS value2,
            COALESCE(d3.freq, 0) AS value3,
            COALESCE(d1.timestamp, d2.timestamp, d3.timestamp) AS timestamp
          FROM
            (SELECT sum(freq) as freq, DATE_FORMAT(timestamp, '%Y-%m-%d') as timestamp FROM power_meter WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE()) and no_device = 1 GROUP BY DATE(timestamp)) AS d1
          LEFT JOIN
            (SELECT sum(freq) as freq, DATE_FORMAT(timestamp, '%Y-%m-%d') as timestamp FROM power_meter WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE()) and no_device = 2 GROUP BY DATE(timestamp)) AS d2
          ON d1.timestamp = d2.timestamp
          LEFT JOIN
            (SELECT sum(freq) as freq, DATE_FORMAT(timestamp, '%Y-%m-%d') as timestamp FROM power_meter WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE()) and no_device = 3 GROUP BY DATE(timestamp)) AS d3
          ON d1.timestamp = d3.timestamp
          ORDER BY timestamp ASC;
          `;
        } else {
          sql = `
            SELECT * FROM (
              SELECT
                DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
                AVG(freq) AS value
              FROM power_meter
              WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE())
              ${device ? "AND no_device = ?" : ""}
              GROUP BY DATE(timestamp)
              ORDER BY timestamp DESC
            ) AS subquery
            ORDER BY timestamp ASC;
          `;
        }
        if (device) params.push(device);
      } else if (req.query.date === "year") {
        // Query untuk mendapatkan rata-rata bulanan untuk tahun ini
        if (device == "all") {
          sql = `
          SELECT
            COALESCE(d1.freq, 0) AS value1,
            COALESCE(d2.freq, 0) AS value2,
            COALESCE(d3.freq, 0) AS value3,
            COALESCE(d1.timestamp, d2.timestamp, d3.timestamp) AS timestamp
          FROM
            (SELECT sum(freq) as freq, DATE_FORMAT(timestamp, '%Y-%m') as timestamp FROM power_meter WHERE YEAR(timestamp) = YEAR(CURDATE()) and no_device = 1 GROUP BY YEAR(timestamp), MONTH(timestamp)) AS d1
          LEFT JOIN
            (SELECT sum(freq) as freq, DATE_FORMAT(timestamp, '%Y-%m') as timestamp FROM power_meter WHERE YEAR(timestamp) = YEAR(CURDATE()) and no_device = 2 GROUP BY YEAR(timestamp), MONTH(timestamp)) AS d2
          ON d1.timestamp = d2.timestamp
          LEFT JOIN
            (SELECT sum(freq) as freq, DATE_FORMAT(timestamp, '%Y-%m') as timestamp FROM power_meter WHERE YEAR(timestamp) = YEAR(CURDATE()) and no_device = 3 GROUP BY YEAR(timestamp), MONTH(timestamp)) AS d3
          ON d1.timestamp = d3.timestamp
          ORDER BY timestamp ASC;
          `;
        } else {
          sql = `
            SELECT * FROM (
              SELECT
                DATE_FORMAT(timestamp, '%Y-%m') AS timestamp,
                AVG(freq) AS value
              FROM power_meter
              WHERE YEAR(timestamp) = YEAR(CURDATE())
              ${device ? "AND no_device = ?" : ""}
              GROUP BY YEAR(timestamp), MONTH(timestamp)
              ORDER BY timestamp DESC
              LIMIT 12
            ) AS subquery
            ORDER BY timestamp ASC;
          `;
        }
        if (device) params.push(device);
      } else {
        // Default: Query untuk mendapatkan data hari ini
        if (device == "all") {
          sql = `
          SELECT
            COALESCE(d1.freq, 0) AS value1,
            COALESCE(d2.freq, 0) AS value2,
            COALESCE(d3.freq, 0) AS value3,
            COALESCE(d1.timestamp, d2.timestamp, d3.timestamp) AS timestamp
          FROM
            (SELECT freq, DATE_FORMAT(timestamp, '%H:%i:%s') as timestamp FROM power_meter WHERE no_device = 1 ORDER BY timestamp DESC LIMIT 250) AS d1
          LEFT JOIN
            (SELECT freq, DATE_FORMAT(timestamp, '%H:%i:%s') as timestamp FROM power_meter WHERE no_device = 2 ORDER BY timestamp DESC LIMIT 250) AS d2
          ON d1.timestamp = d2.timestamp
          LEFT JOIN
            (SELECT freq, DATE_FORMAT(timestamp, '%H:%i:%s') as timestamp FROM power_meter WHERE no_device = 3 ORDER BY timestamp DESC LIMIT 250) AS d3
          ON d1.timestamp = d3.timestamp
          ORDER BY timestamp DESC;
          `;
        } else {
          sql = `
            SELECT * FROM (
              SELECT freq AS value, DATE_FORMAT(timestamp, '%H:%i:%s') AS timestamp
              FROM power_meter
              WHERE DATE(timestamp) = CURDATE()
              ${device ? "AND no_device = ?" : ""}
              ORDER BY timestamp DESC
              LIMIT 250
            ) AS subquery
            ORDER BY timestamp ASC;
          `;
        }
        if (device) params.push(device);
      }
    }

    // Eksekusi query utama
    const [result] = await connection.execute(sql, params);

    // Mengatur data response
    response.data = result;

    await connection.release();

    res.json(response);
  } catch (error) {
    console.error("Error fetching data from database:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getTemperatureData(req, res) {
  try {
    const connection = await db.getConnection();
    const device = req.query.device;
    let sql, response;
    let params = [];

    response = {
      status: "success",
      data: {},
      label: device == "all" ? ["Device 1", "Device 2"] : ["Temperature"],
    };

    if (req.query.endDate) {
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;

      if (device == "all") {
        sql = `
        SELECT
          COALESCE(d1.temp, 0) AS value1,
          COALESCE(d2.temp, 0) AS value2,
          COALESCE(d1.timestamp, d2.timestamp) AS timestamp
        FROM
          (SELECT sum(temp) as temp, DATE_FORMAT(timestamp, '%Y-%m-%d') as timestamp FROM temp_control WHERE DATE(timestamp) BETWEEN ? AND ? and no_device = 1 GROUP BY DATE(timestamp)) AS d1
        LEFT JOIN
          (SELECT sum(temp) as temp, DATE_FORMAT(timestamp, '%Y-%m-%d') as timestamp FROM temp_control WHERE DATE(timestamp) BETWEEN ? AND ? and no_device = 2 GROUP BY DATE(timestamp)) AS d2
        ON d1.timestamp = d2.timestamp
        
        ORDER BY timestamp ASC;
        `;

        params = [startDate, endDate, startDate, endDate];
      } else {
        sql = `
          SELECT * FROM (
            SELECT
              DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
              AVG(temp) AS value
            FROM temp_control
            WHERE DATE(timestamp) BETWEEN ? AND ?
            ${device ? "AND no_device = ?" : ""}
            GROUP BY DATE(timestamp)
            ORDER BY timestamp DESC
            LIMIT 250
          ) AS subquery
          ORDER BY timestamp ASC;
        `;
        params = [startDate, endDate];
        if (device) params.push(device);
      }
    } else {
      if (req.query.date === "month") {
        // Query untuk mendapatkan rata-rata harian untuk bulan ini
        if (device == "all") {
          sql = `
          SELECT
            COALESCE(d1.temp, 0) AS value1,
            COALESCE(d2.temp, 0) AS value2,
            COALESCE(d1.timestamp, d2.timestamp) AS timestamp
          FROM
            (SELECT sum(temp) as temp, DATE_FORMAT(timestamp, '%Y-%m-%d') as timestamp FROM temp_control WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE()) and no_device = 1 GROUP BY DATE(timestamp)) AS d1
          LEFT JOIN
            (SELECT sum(temp) as temp, DATE_FORMAT(timestamp, '%Y-%m-%d') as timestamp FROM temp_control WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE()) and no_device = 2 GROUP BY DATE(timestamp)) AS d2
          ON d1.timestamp = d2.timestamp
          ORDER BY timestamp ASC;
          `;
        } else {
          sql = `
            SELECT * FROM (
              SELECT
                DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
                AVG(temp) AS value
              FROM temp_control
              WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE())
              ${device ? "AND no_device = ?" : ""}
              GROUP BY DATE(timestamp)
              ORDER BY timestamp DESC
            ) AS subquery
            ORDER BY timestamp ASC;
          `;
          if (device) params.push(device);
        }
      } else if (req.query.date === "year") {
        // Query untuk mendapatkan rata-rata bulanan untuk tahun ini
        if (device == "all") {
          sql = `
          SELECT
            COALESCE(d1.temp, 0) AS value1,
            COALESCE(d2.temp, 0) AS value2,
            COALESCE(d1.timestamp, d2.timestamp) AS timestamp
          FROM
            (SELECT sum(temp) as temp, DATE_FORMAT(timestamp, '%Y-%m') as timestamp FROM temp_control WHERE YEAR(timestamp) = YEAR(CURDATE()) and no_device = 1 GROUP BY YEAR(timestamp), MONTH(timestamp)) AS d1
          LEFT JOIN
            (SELECT sum(temp) as temp, DATE_FORMAT(timestamp, '%Y-%m') as timestamp FROM temp_control WHERE YEAR(timestamp) = YEAR(CURDATE()) and no_device = 2 GROUP BY YEAR(timestamp), MONTH(timestamp)) AS d2
          ON d1.timestamp = d2.timestamp
          ORDER BY timestamp ASC;
          `;
        } else {
          sql = `
            SELECT * FROM (
              SELECT
                DATE_FORMAT(timestamp, '%Y-%m') AS timestamp,
                AVG(temp) AS value
              FROM temp_control
              WHERE YEAR(timestamp) = YEAR(CURDATE())
              ${device ? "AND no_device = ?" : ""}
              GROUP BY YEAR(timestamp), MONTH(timestamp)
              ORDER BY timestamp DESC
              LIMIT 12
            ) AS subquery
            ORDER BY timestamp ASC;
          `;
          if (device) params.push(device);
        }
      } else {
        // Default: Query untuk mendapatkan data hari ini
        if (device == "all") {
          sql = `
          SELECT
            COALESCE(d1.temp, 0) AS value1,
            COALESCE(d2.temp, 0) AS value2,
            COALESCE(d1.timestamp, d2.timestamp) AS timestamp
          FROM
            (SELECT temp, DATE_FORMAT(timestamp, '%H:%i:%s') as timestamp FROM temp_control WHERE no_device = 1 ORDER BY timestamp DESC LIMIT 250) AS d1
          LEFT JOIN
            (SELECT temp, DATE_FORMAT(timestamp, '%H:%i:%s') as timestamp FROM temp_control WHERE no_device = 2 ORDER BY timestamp DESC LIMIT 250) AS d2
          ON d1.timestamp = d2.timestamp
          ORDER BY timestamp DESC;
          `;
        } else {
          sql = `
            SELECT * FROM (
              SELECT temp AS value, DATE_FORMAT(timestamp, '%H:%i:%s') AS timestamp
              FROM temp_control
              WHERE DATE(timestamp) = CURDATE()
              ${device ? "AND no_device = ?" : ""}
              ORDER BY timestamp DESC
              LIMIT 250
            ) AS subquery
            ORDER BY timestamp ASC;
          `;
          if (device) params.push(device);
        }
      }
    }

    // Eksekusi query utama
    const [result] = await connection.execute(sql, params);

    // Mengatur data response
    response.data = result;

    await connection.release();

    res.json(response);
  } catch (error) {
    console.error("Error fetching data from database:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getDailyWattCostData(req, res) {
  try {
    const connection = await db.getConnection();
    const device = req.query.device;
    let response, sql, query;

    response = {
      status: "success",
      data: {},
      summary: {
        total: {},
      },
      label: device == "all" ? ["Device 1", "Device 2"] : ["Watt Hour Cost"],
    };

    // Query untuk mendapatkan data penggunaan listrik per jam dan total penggunaan listrik
    if (device == "all") {
      sql = `
        SELECT
          COALESCE(d1.kw, 0) AS value1,
          COALESCE(d2.kw, 0) AS value2,
          COALESCE(d1.timestamp, d2.timestamp) AS timestamp
        FROM
          (SELECT SUM(kw) as kw, DATE_FORMAT(timestamp, '%H:00-%H:59') AS timestamp FROM power_meter WHERE DATE(timestamp) = CURDATE() and no_device = 1 GROUP BY HOUR(timestamp)) AS d1
        LEFT JOIN
          (SELECT SUM(kw) as kw, DATE_FORMAT(timestamp, '%H:00-%H:59') AS timestamp FROM power_meter WHERE DATE(timestamp) = CURDATE() and no_device = 2 GROUP BY HOUR(timestamp)) AS d2
        ON d1.timestamp = d2.timestamp
        ORDER BY HOUR(d1.timestamp);
        `;

      query = `
        SELECT
          (SELECT SUM(kw) as kw FROM power_meter WHERE DATE(timestamp) = CURDATE() and no_device = 1) AS value1,
          (SELECT SUM(kw) as kw FROM power_meter WHERE DATE(timestamp) = CURDATE() and no_device = 2) AS value2
        `;
    } else {
      sql = `
        SELECT DATE_FORMAT(timestamp, '%H:00-%H:59') AS timestamp,
          SUM(kw * 1300 / 1000) AS value
        FROM power_meter
        WHERE DATE(timestamp) = CURDATE() and no_device = ${device}
        GROUP BY DATE_FORMAT(timestamp, '%H:00:00')
        ORDER BY DATE_FORMAT(timestamp, '%H:00:00');

      `;

      query = `
        SELECT DATE_FORMAT(timestamp, '%H:00-%H:59') AS timestamp,
          SUM(kw * 1300 / 1000) AS value1
        FROM power_meter
        WHERE DATE(timestamp) = CURDATE() and no_device = ${device}
        ORDER BY HOUR(timestamp);
      `;
    }

    // Eksekusi query utama
    const [result] = await connection.execute(sql);
    const [result2] = await connection.execute(query);

    const result2Value = [result2[0].value1, result2[0].value2];

    // Mengatur data response
    response.data = result;
    response.summary.total = result2Value;

    await connection.release();

    res.json(response);
  } catch (error) {
    console.error("Error fetching data from database:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getMonthlyWattCostData(req, res) {
  try {
    const connection = await db.getConnection();
    const device = req.query.device;
    let response, sql, query;

    response = {
      status: "success",
      data: {},
      summary: {
        total: {},
      },
      label: device == "all" ? ["Device 1", "Device 2"] : ["Watt Daily Cost"],
    };

    // Query untuk mendapatkan data penggunaan listrik per jam dan total penggunaan listrik
    if (device == "all") {
      sql = `
      SELECT
        COALESCE(d1.kw, 0) AS value1,
        COALESCE(d2.kw, 0) AS value2,
        COALESCE(d1.timestamp, d2.timestamp) AS timestamp
      FROM
        (SELECT SUM(kw) as kw, DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp FROM power_meter WHERE MONTH(timestamp) = MONTH(CURDATE()) and no_device = 1 GROUP BY DATE(timestamp)) AS d1
      LEFT JOIN
        (SELECT SUM(kw) as kw, DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp FROM power_meter WHERE MONTH(timestamp) = MONTH(CURDATE()) and no_device = 2 GROUP BY DATE(timestamp)) AS d2
      ON d1.timestamp = d2.timestamp
      ORDER BY DATE(d1.timestamp);
      `;

      query = `
      SELECT
        (SELECT SUM(kw) as kw FROM power_meter WHERE MONTH(timestamp) = MONTH(CURDATE()) and no_device = 1) AS value1,
        (SELECT SUM(kw) as kw FROM power_meter WHERE MONTH(timestamp) = MONTH(CURDATE()) and no_device = 2) AS value2
      `;
    } else {
      sql = `
        SELECT DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
          SUM(kw * 1300 / 1000) AS value
        FROM power_meter
        WHERE MONTH(timestamp) = MONTH(CURDATE()) and no_device = ${device}
        GROUP BY DATE(timestamp)
        ORDER BY DATE(timestamp);
      `;

      query = `
        SELECT DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
          SUM(kw * 1300 / 1000) AS value1
        FROM power_meter
        WHERE MONTH(timestamp) = MONTH(CURDATE()) and no_device = ${device}
        ORDER BY DATE(timestamp);
      `;
    }

    // Eksekusi query utama
    const [result] = await connection.execute(sql);
    const [result2] = await connection.execute(query);

    const result2Value = [result2[0].value1, result2[0].value2];

    // Mengatur data response
    response.data = result;
    response.summary.total = result2Value;

    await connection.release();

    res.json(response);
  } catch (error) {
    console.error("Error fetching data from database:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getYearlyWattCostData(req, res) {
  try {
    const connection = await db.getConnection();
    const device = req.query.device;
    let response, sql, query;

    response = {
      status: "success",
      data: {},
      summary: {
        total: {},
      },
      label: device == "all" ? ["Device 1", "Device 2"] : ["Watt Monthly Cost"],
    };

    // Query untuk mendapatkan data penggunaan listrik per jam dan total penggunaan listrik
    if (device == "all") {
      sql = `
      SELECT
        COALESCE(d1.kw, 0) AS value1,
        COALESCE(d2.kw, 0) AS value2,
        COALESCE(d1.timestamp, d2.timestamp) AS timestamp
      FROM
        (SELECT SUM(kw) as kw, DATE_FORMAT(timestamp, '%Y-%m') AS timestamp FROM power_meter WHERE YEAR(timestamp) = YEAR(CURDATE()) and no_device = 1 GROUP BY MONTH(timestamp)) AS d1
      LEFT JOIN
        (SELECT SUM(kw) as kw, DATE_FORMAT(timestamp, '%Y-%m') AS timestamp FROM power_meter WHERE YEAR(timestamp) = YEAR(CURDATE()) and no_device = 2 GROUP BY MONTH(timestamp)) AS d2
      ON d1.timestamp = d2.timestamp
      ORDER BY DATE(d1.timestamp);
      `;

      query = `
      SELECT
        (SELECT SUM(kw) as kw FROM power_meter WHERE YEAR(timestamp) = YEAR(CURDATE()) and no_device = 1) AS value1,
        (SELECT SUM(kw) as kw FROM power_meter WHERE YEAR(timestamp) = YEAR(CURDATE()) and no_device = 2) AS value2
      `;
    } else {
      sql = `
        SELECT DATE_FORMAT(timestamp, '%Y-%m') AS timestamp,
          SUM(kw * 1300 / 1000) AS value
        FROM power_meter
        WHERE YEAR(timestamp) = YEAR(CURDATE()) and no_device = ${device}
        GROUP BY MONTH(timestamp)
        ORDER BY MONTH(timestamp);
      `;

      query = `
        SELECT DATE_FORMAT(timestamp, '%Y-%m') AS timestamp,
          SUM(kw * 1300 / 1000) AS value1
        FROM power_meter
        WHERE YEAR(timestamp) = YEAR(CURDATE()) and no_device = ${device}
        ORDER BY MONTH(timestamp);
      `;
    }

    // Eksekusi query utama
    const [result] = await connection.execute(sql);
    const [result2] = await connection.execute(query);

    const result2Value = [result2[0].value1, result2[0].value2];

    // Mengatur data response
    response.data = result;
    response.summary.total = result2Value;

    await connection.release();

    res.json(response);
  } catch (error) {
    console.error("Error fetching data from database:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getCustomWattCostData(req, res) {
  try {
    const connection = await db.getConnection();
    const device = req.query.device;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    let response, sql, query;

    response = {
      status: "success",
      data: {},
      summary: {
        total: {},
      },
      label: device == "all" ? ["Device 1", "Device 2"] : ["Watt Custom Cost"],
    };

    // Query untuk mendapatkan data penggunaan listrik per jam dan total penggunaan listrik
    if (device == "all") {
      sql = `
      SELECT
        COALESCE(d1.kw, 0) AS value1,
        COALESCE(d2.kw, 0) AS value2,
        COALESCE(d1.timestamp, d2.timestamp) AS timestamp
      FROM
        (SELECT SUM(kw) as kw, DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp FROM power_meter WHERE DATE(timestamp) BETWEEN ? AND ? and no_device = 1 GROUP BY DATE(timestamp)) AS d1
      LEFT JOIN
        (SELECT SUM(kw) as kw, DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp FROM power_meter WHERE DATE(timestamp) BETWEEN ? AND ? and no_device = 2 GROUP BY DATE(timestamp)) AS d2
      ON d1.timestamp = d2.timestamp
      ORDER BY DATE(d1.timestamp);
      `;

      query = `
      SELECT
        (SELECT SUM(kw) as kw FROM power_meter WHERE DATE(timestamp) BETWEEN ? AND ? and no_device = 1) AS value1,
        (SELECT SUM(kw) as kw FROM power_meter WHERE DATE(timestamp) BETWEEN ? AND ? and no_device = 2) AS value2
      `;
    } else {
      sql = `
        SELECT * FROM (
          SELECT
            DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
            SUM(kw) AS value
          FROM power_meter
          WHERE DATE(timestamp) BETWEEN ? AND ? and no_device = ${device}
          GROUP BY DATE(timestamp)
          ORDER BY timestamp DESC
          LIMIT 250
        ) AS subquery
        ORDER BY timestamp ASC;
      `;

      // Query untuk mendapatkan total penggunaan listrik dan rata-rata penggunaan listrik sesuai rentang tanggal yang diminta
      query = `
        SELECT DATE_FORMAT(timestamp, '%Y-%m') AS timestamp,
          SUM(kW) AS total_kW,
          AVG(kw) AS avg_kW
        FROM power_meter
        WHERE DATE(timestamp) BETWEEN ? AND ? and no_device = ${device}
        ORDER BY timestamp;
      `;
    }

    // Eksekusi query
    const [result] = await connection.execute(
      sql,
      device == "all"
        ? [startDate, endDate, startDate, endDate]
        : [startDate, endDate]
    );
    const [result2] = await connection.execute(
      query,
      device == "all"
        ? [startDate, endDate, startDate, endDate]
        : [startDate, endDate]
    );
    const result2Value = [result2[0].value1, result2[0].value2];

    // Menyusun response data
    response.data = result;
    response.summary.total = result2Value;

    await connection.release();

    res.json(response);
  } catch (error) {
    console.error("Error fetching data from database:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getDashboardData(req, res) {
  try {
    const connection = await db.getConnection();
    let sql;

    const response = {
      status: "success",
      data: {},
      label: ["Power Meter 1", "Power Meter 2", "Power Meter 3"],
    };

    // Query untuk mendapatkan data penggunaan listrik per jam dan total penggunaan listrik
    sql = `
    SELECT
      (SELECT SUM(kw) as kw FROM power_meter WHERE DATE(timestamp) = CURDATE() and no_device = 1) AS value1,
      (SELECT SUM(kw) as kw FROM power_meter WHERE DATE(timestamp) = CURDATE() and no_device = 2) AS value2,
      (SELECT SUM(kw) as kw FROM power_meter WHERE DATE(timestamp) = CURDATE() and no_device = 3) AS value3
    `;

    // Eksekusi query utama
    const [result] = await connection.execute(sql);

    // Mengatur data response
    response.data = result;

    await connection.release();

    res.json(response);
  } catch (error) {
    console.error("Error fetching data from database:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = {
  getVoltData,
  getCurrentData,
  getWattData,
  getKvaData,
  getFrequencyData,
  getTemperatureData,
  getDailyWattCostData,
  getMonthlyWattCostData,
  getYearlyWattCostData,
  getCustomWattCostData,
  getDashboardData,
};
