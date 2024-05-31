const db = require("../config/db.config");

async function getVoltData(req, res) {
  try {
    const connection = await db.getConnection();
    const device = req.query.device;
    let response, sql;
    let params = [];

    response = {
      status: "success",
      data: {},
      label: device 
        ? ["Device 1", "Device 2", "Device 3"]
        : ["Volt 1", "Volt 2", "Volt 3"],
    };

    if (req.query.endDate) {
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;
      if (device == "volt1" || device == "volt2" || device == "volt3") {
        sql = `
          SELECT
            d1.timestamp AS timestamp,
            COALESCE(d1.value1, 0) AS value1,
            COALESCE(d2.value2, 0) AS value2,
            COALESCE(d3.value3, 0) AS value3
          FROM
            (SELECT
              DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
              AVG(${device}) AS value1
            FROM power_meter
            WHERE DATE(timestamp) BETWEEN ? AND ? AND no_device = 1
            GROUP BY DATE(timestamp)
            ORDER BY timestamp DESC
            LIMIT 250) AS d1
          LEFT JOIN
            (SELECT
              DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
              AVG(${device}) AS value2
            FROM power_meter
            WHERE DATE(timestamp) BETWEEN ? AND ? AND no_device = 2
            GROUP BY DATE(timestamp)
            ORDER BY timestamp DESC
            LIMIT 250) AS d2
            ON d1.timestamp = d2.timestamp
          LEFT JOIN
            (SELECT
              DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
              AVG(${device}) AS value3
            FROM power_meter
            WHERE DATE(timestamp) BETWEEN ? AND ? AND no_device = 3
            GROUP BY DATE(timestamp)
            ORDER BY timestamp DESC
            LIMIT 250) AS d3
            ON d1.timestamp = d3.timestamp
          ORDER BY d1.timestamp;
        `;
        params = [startDate, endDate, startDate, endDate, startDate, endDate];
      } else {
        sql = `
          SELECT * FROM (
            SELECT
              DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
              AVG(volt3) AS value3,
              AVG(volt2) AS value2,
              AVG(volt1) AS value1
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
        if (device == "volt1" || device == "volt2" || device == "volt3") {
          sql = `
            SELECT
              d1.timestamp AS timestamp,
              COALESCE(d1.value1, 0) AS value1,
              COALESCE(d2.value2, 0) AS value2,
              COALESCE(d3.value3, 0) AS value3
            FROM
              (SELECT
                DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
                AVG(${device}) AS value1
              FROM power_meter
              WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE()) AND no_device = 1
              GROUP BY DATE(timestamp)
              ORDER BY timestamp DESC) AS d1
            LEFT JOIN
              (SELECT
                DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
                AVG(${device}) AS value2
              FROM power_meter
              WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE()) AND no_device = 2
              GROUP BY DATE(timestamp)
              ORDER BY timestamp DESC) AS d2
              ON d1.timestamp = d2.timestamp
            LEFT JOIN
              (SELECT
                DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
                AVG(${device}) AS value3
              FROM power_meter
              WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE()) AND no_device = 3
              GROUP BY DATE(timestamp)
              ORDER BY timestamp DESC) AS d3
              ON d1.timestamp = d3.timestamp
            ORDER BY d1.timestamp;
          `;
        } else {
          sql = `
          SELECT * FROM (
            SELECT
              DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
              AVG(volt3) AS value3,
              AVG(volt2) AS value2,
              AVG(volt1) AS value1
            FROM power_meter
            WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE())
            ${device ? "AND no_device = ?" : ""}
            GROUP BY DATE(timestamp)
            ORDER BY timestamp DESC
            LIMIT 250
          ) AS subquery
          ORDER BY timestamp ASC;
          `;
        }
        if (device) params.push(device);
      } else if (req.query.date === "year") {
        // Query untuk mendapatkan rata-rata bulanan untuk tahun ini
        if (device == "volt1" || device == "volt2" || device == "volt3") {
          sql = `
            SELECT
              d1.timestamp AS timestamp,
              COALESCE(d1.value1, 0) AS value1,
              COALESCE(d2.value2, 0) AS value2,
              COALESCE(d3.value3, 0) AS value3
            FROM
              (SELECT
                DATE_FORMAT(timestamp, '%Y-%m') AS timestamp,
                AVG(${device}) AS value1
              FROM power_meter
              WHERE YEAR(timestamp) = YEAR(CURDATE()) AND no_device = 1
              GROUP BY YEAR(timestamp), MONTH(timestamp)
              ORDER BY timestamp DESC) AS d1
            LEFT JOIN
              (SELECT
                DATE_FORMAT(timestamp, '%Y-%m') AS timestamp,
                AVG(${device}) AS value2
              FROM power_meter
              WHERE YEAR(timestamp) = YEAR(CURDATE()) AND no_device = 2
              GROUP BY YEAR(timestamp), MONTH(timestamp)
              ORDER BY timestamp DESC) AS d2
              ON d1.timestamp = d2.timestamp
            LEFT JOIN
              (SELECT
                DATE_FORMAT(timestamp, '%Y-%m') AS timestamp,
                AVG(${device}) AS value3
              FROM power_meter
              WHERE YEAR(timestamp) = YEAR(CURDATE()) AND no_device = 3
              GROUP BY YEAR(timestamp), MONTH(timestamp)
              ORDER BY timestamp DESC) AS d3
              ON d1.timestamp = d3.timestamp
            ORDER BY d1.timestamp;        
          `;
        } else {
          sql = `
          SELECT * FROM (
            SELECT
              DATE_FORMAT(timestamp, '%Y-%m') AS timestamp,
              AVG(volt3) AS value3,
              AVG(volt2) AS value2,
              AVG(volt1) AS value1
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
        if (device == "volt1" || device == "volt2" || device == "volt3") {
          sql = `
            SELECT
              COALESCE(d1.${device}, 0) AS value1,
              COALESCE(d2.${device}, 0) AS value2,
              COALESCE(d3.${device}, 0) AS value3,
              COALESCE(d1.timestamp, d2.timestamp, d3.timestamp) AS timestamp
            FROM
              (SELECT ${device}, DATE_FORMAT(timestamp, '%H:%i:%s') as timestamp FROM power_meter WHERE no_device = 1 ORDER BY timestamp DESC LIMIT 250) AS d1
            LEFT JOIN
              (SELECT ${device}, DATE_FORMAT(timestamp, '%H:%i:%s') as timestamp FROM power_meter WHERE no_device = 2 ORDER BY timestamp DESC LIMIT 250) AS d2
            ON d1.timestamp = d2.timestamp
            LEFT JOIN
              (SELECT ${device}, DATE_FORMAT(timestamp, '%H:%i:%s') as timestamp FROM power_meter WHERE no_device = 3 ORDER BY timestamp DESC LIMIT 250) AS d3
            ON d1.timestamp = d3.timestamp
            ORDER BY timestamp DESC;
          `;
        } else {
          sql = `
          SELECT *
          FROM (
              SELECT volt3 as value3, volt2 as value2, volt1 as value1, DATE_FORMAT(timestamp, '%H:%i:%s') AS timestamp
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

    const [result] = await connection.execute(sql, params);
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
};
