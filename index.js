const mqtt = require("mqtt");
const mysql = require("mysql2/promise");
const express = require("express");
const app = express();
const port = 3002;
const util = require("util");

const client = mqtt.connect("mqtt://broker.emqx.io:1883");

const dbConfig = {
  host: "localhost",
  user: "root",
  database: "power_monitoring",
  port: 3306,
  // password: '',
};

async function insertDB(val) {
  try {
    const connection = await mysql.createConnection(dbConfig);

    // Pastikan val memiliki jumlah nilai yang sesuai dengan jumlah kolom yang diharapkan
    if (val.length !== 10) {
      console.error(
        "Jumlah nilai tidak sesuai dengan jumlah kolom yang diharapkan."
      );
      await connection.end();
      return;
    }

    const sql = `INSERT INTO logs (temp, kva, kw,amp3,amp2,amp1, frequency,volt3,volt2,volt1,timestamp) VALUES (?, ?, ?, ?,?,?,?,?,?,?, NOW())`;

    // Menggunakan promisify untuk mengubah callback ke Promise
    const queryAsync = util.promisify(connection.query).bind(connection);

    // Menjalankan query dengan nilai val
    const result = await queryAsync({
      sql,
      values: val,
    });

    // Menutup koneksi
    await connection.end();
  } catch (error) {
    console.error("Error inserting data:", error);
  }
}

async function createTables(connection) {
  const createPowerMeterTable = `
      CREATE TABLE IF NOT EXISTS power_meter (
          id INT AUTO_INCREMENT PRIMARY KEY,
          no_device INT,
          kva FLOAT,
          kw FLOAT,
          volt1 FLOAT,
          volt2 FLOAT,
          volt3 FLOAT,
          amp1 FLOAT,
          amp2 FLOAT,
          amp3 FLOAT,
          freq FLOAT,
          timestamp datetime
      );
  `;

  const createTempControlTable = `
      CREATE TABLE IF NOT EXISTS temp_control (
          id INT AUTO_INCREMENT PRIMARY KEY,
          no_device INT,
          temp FLOAT,
          timestamp datetime
      );
  `;

  await connection.execute(createPowerMeterTable);
  await connection.execute(createTempControlTable);
}

function extractNumber(deviceName) {
  const match = deviceName.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

async function insertData(data) {
  const connection = await mysql.createConnection(dbConfig);

  try {
    await createTables(connection);
    await connection.beginTransaction();

    for (const device of data.data) {
      const deviceName = device.name;
      const noDevice = extractNumber(deviceName);

      if (deviceName.startsWith("Power Meter")) {
        const values = device.values.reduce((acc, value) => {
          acc[value.name.replace(" ", "_").toLowerCase()] = value.raw_data;
          return acc;
        }, {});

        const query = `
                  INSERT INTO power_meter (no_device, kva, kw, volt1, volt2, volt3, amp1, amp2, amp3, freq, timestamp)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
              `;
        const params = [
          noDevice,
          values.kva || 0,
          values.kw || 0,
          values.v1 || 0,
          values.v2 || 0,
          values.v3 || 0,
          values.t_current || 0,
          values.s_current || 0,
          values.r_current || 0,
          values.frequency || 0,
        ];

        await connection.execute(query, params);

        console.log(`Data for Power Meter ${noDevice} inserted successfully.`);
      } else if (deviceName.startsWith("Temperature")) {
        for (const value of device.values) {
          const query = `
                      INSERT INTO temp_control (no_device, temp, timestamp)
                      VALUES (?, ?, NOW())
                  `;
          const params = [noDevice, value.raw_data];

          await connection.execute(query, params);

          console.log(
            `Data for Temperature Sensor ${noDevice} inserted successfully.`
          );
        }
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error("Error inserting data:", error);
  } finally {
    await connection.end();
  }
}

client.on("connect", () => {
  console.log("mqtt connected");
});

client.subscribe("toho").on("message", (topic, payload) => {
  try {
    // console.log("🚀 ~ client.subscribe ~ payload:", payload);
    const data = JSON.parse(payload);
    // console.log("🚀 ~ client.subscribe ~ data:", data);
    const raw_data_array = [];
    insertData(data);

    // Iterasi melalui setiap parameter dan nilai raw_data
    // data.data.forEach((item) => {
    //   item.values.forEach((value) => {
    //     raw_data_array.push(value.raw_data);
    //   });
    // });

    // Extract Temperature 1
    // data.data.forEach((device) => {
    //   if (device.name === "Temperature Controller") {
    //     device.values.forEach((value) => {
    //       if (value.name === "Temperature 1") {
    //         raw_data_array.push(value.raw_data);
    //       }
    //     });
    //   }
    // });

    // Extract Power Meter 1 values in the specified order
    // data.data.forEach((device) => {
    //   if (device.name === "Power Meter 1") {
    //     let valueMap = {
    //       KVA: null,
    //       KW: null,
    //       "T Current": null,
    //       "S Current": null,
    //       "R Current": null,
    //       Frequency: null,
    //       V3: null,
    //       V2: null,
    //       V1: null,
    //     };

    //     device.values.forEach((value) => {
    //       if (value.name in valueMap) {
    //         valueMap[value.name] = value.raw_data;
    //       }
    //     });

    //     raw_data_array.push(
    //       valueMap.KVA,
    //       valueMap.KW,
    //       valueMap["T Current"],
    //       valueMap["S Current"],
    //       valueMap["R Current"],
    //       valueMap.Frequency,
    //       valueMap.V3,
    //       valueMap.V2,
    //       valueMap.V1
    //     );
    //   }
    // });

    // Memanggil fungsi insertDB dengan raw_data_array
    // insertDB(raw_data_array)
    //   .then(() => {
    //     console.log("Data inserted successfully " + new Date());
    //   })
    //   .catch((error) => {
    //     console.error("Error inserting data:", error);
    //   });
  } catch (error) {
    console.error("Error parsing JSON or converting string to integer:", error);
  }
});

// Middleware untuk mengizinkan CORS (Cross-Origin Resource Sharing)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.get("/volt", async (req, res) => {
  try {
    // Membuat koneksi ke database
    const connection = await mysql.createConnection(dbConfig);

    // Mengambil parameter device jika ada
    const device = req.query.device;
    let response, sql;
    let params = [];

    // json response format
    if (device == "volt1" || device == "volt2" || device == "volt3") {
      response = {
        status: "success",
        data: {},
        label: ["Device 1", "Device 2", "Device 3"],
      };
    } else {
      response = {
        status: "success",
        data: {},
        label: ["Volt 1", "Volt 2", "Volt 3"],
      };
    }

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
          if (device) params.push(device);
        }
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
          if (device) params.push(device);
        }
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
          if (device) params.push(device);
        }
      }
    }

    // Eksekusi query dengan parameter
    const [result] = await connection.execute(sql, params);

    response.data = result;

    // Menutup koneksi ke database
    await connection.end();

    // Mengirimkan data sebagai respons
    res.json(response);
  } catch (error) {
    console.error("Error fetching data from database:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/current", async (req, res) => {
  try {
    // Membuat koneksi ke database
    const connection = await mysql.createConnection(dbConfig);

    // Mengambil parameter device jika ada
    const device = req.query.device;
    let sql, response;
    let params = []; // json response format

    if (device == "amp1" || device == "amp2" || device == "amp3") {
      response = {
        status: "success",
        data: {},
        label: ["Device 1", "Device 2", "Device 3"],
      };
    } else {
      response = {
        status: "success",
        data: {},
        label: ["Current 1", "Current 2", "Current 3"],
      };
    }

    if (req.query.endDate) {
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;

      if (device == "amp1" || device == "amp2" || device == "amp3") {
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
              AVG(amp3) AS value3,
              AVG(amp2) AS value2,
              AVG(amp1) AS value1
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
        if (device == "amp1" || device == "amp2" || device == "amp3") {
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
                AVG(amp3) AS value3,
                AVG(amp2) AS value2,
                AVG(amp1) AS value1
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
        if (device == "amp1" || device == "amp2" || device == "amp3") {
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
                AVG(amp3) AS value3,
                AVG(amp2) AS value2,
                AVG(amp1) AS value1
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
        if (device == "amp1" || device == "amp2" || device == "amp3") {
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
              SELECT amp3 as value3, amp2 as value2, amp1 as value1, DATE_FORMAT(timestamp, '%H:%i:%s') AS timestamp
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

    // Eksekusi query dengan parameter
    const [result] = await connection.execute(sql, params);

    response.data = result;

    // Menutup koneksi ke database
    await connection.end();

    // Mengirimkan data sebagai respons
    res.json(response);
  } catch (error) {
    console.error("Error fetching data from database:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/watt", async (req, res) => {
  try {
    // Membuat koneksi ke database
    const connection = await mysql.createConnection(dbConfig);

    let sql, totalQuery, avgQuery, response;
    let params = [];

    // Mengambil parameter device jika ada
    const device = req.query.device;

    // json response format
    if (device == "all") {
      response = {
        status: "success",
        data: {},
        summary: {
          average: {},
          total: {},
        },
        label: ["Device 1", "Device 2", "Device 3"],
      };
    } else {
      response = {
        status: "success",
        data: {},
        summary: {
          average: {},
          total: {},
        },
        label: ["Watt"],
      };
    }

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

    // Menutup koneksi ke database
    await connection.end();

    // Mengirimkan data sebagai respons
    res.json(response);
  } catch (error) {
    console.error("Error fetching data from database:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/kva", async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);

    let sql, response;
    let params = [];

    // Mengambil parameter device jika ada
    const device = req.query.device;

    // json response format
    if (device == "all") {
      response = {
        status: "success",
        data: {},
        label: ["Device 1", "Device 2", "Device 3"],
      };
    } else {
      response = {
        status: "success",
        data: {},
        label: ["KVA"],
      };
    }

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

    // Eksekusi query
    const [result] = await connection.execute(sql, params);

    // Mengatur data response
    response.data = result;

    // Menutup koneksi ke database
    await connection.end();

    // Mengirimkan data sebagai respons
    res.json(response);
  } catch (error) {
    console.error("Error fetching data from database:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/frequency", async (req, res) => {
  try {
    // Membuat koneksi ke database
    const connection = await mysql.createConnection(dbConfig);

    let sql, response;
    let params = [];

    // Mengambil parameter device jika ada
    const device = req.query.device;

    // json response format
    if (device == "all") {
      response = {
        status: "success",
        data: {},
        label: ["Device 1", "Device 2", "Device 3"],
      };
    } else {
      response = {
        status: "success",
        data: {},
        label: ["Frequency"],
      };
    }

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

    // Eksekusi query
    const [result] = await connection.execute(sql, params);

    // Mengatur data response
    response.data = result;

    // Menutup koneksi ke database
    await connection.end();

    // Mengirimkan data sebagai respons
    res.json(response);
  } catch (error) {
    console.error("Error fetching data from database:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/temp", async (req, res) => {
  try {
    // Membuat koneksi ke database
    const connection = await mysql.createConnection(dbConfig);

    let sql, response;
    let params = [];

    // Mengambil parameter device jika ada
    const device = req.query.device;

    // json response format
    if (device == "all") {
      response = {
        status: "success",
        data: {},
        label: ["Device 1", "Device 2"],
      };
    } else {
      response = {
        status: "success",
        data: {},
        label: ["Temperature"],
      };
    }

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

    // Eksekusi query
    const [result] = await connection.execute(sql, params);

    // Mengatur data response
    response.data = result;

    // Menutup koneksi ke database
    await connection.end();

    // Mengirimkan data sebagai respons
    res.json(response);
  } catch (error) {
    console.error("Error fetching data from database:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/kw_hour", async (req, res) => {
  try {
    // Membuat koneksi ke database
    const connection = await mysql.createConnection(dbConfig);
    const device = req.query.device;
    let response, sql, query;

    // json response format
    if (device == "all") {
      response = {
        status: "success",
        data: {},
        summary: {
          total: {},
        },
        label: ["Device 1", "Device 2"],
      };
    } else {
      response = {
        status: "success",
        data: {},
        summary: {
          total: {},
        },
        label: ["Watt Hour Cost"],
      };
    }

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
        GROUP BY HOUR(timestamp)
        ORDER BY HOUR(timestamp);
      `;

      query = `
        SELECT DATE_FORMAT(timestamp, '%H:00-%H:59') AS timestamp,
          SUM(kw * 1300 / 1000) AS value1
        FROM power_meter
        WHERE DATE(timestamp) = CURDATE() and no_device = ${device}
        ORDER BY HOUR(timestamp);
      `;
    }

    // Eksekusi query
    const [result] = await connection.execute(sql);
    const [result2] = await connection.execute(query);

    const result2Value = [result2[0].value1, result2[0].value2];
    // Menyusun response data
    response.data = result;
    response.summary.total = result2Value;

    // Menutup koneksi ke database
    await connection.end();

    // Mengirimkan data sebagai respons
    res.json(response);
  } catch (error) {
    console.error("Error fetching data from database:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/kw_day", async (req, res) => {
  try {
    // Membuat koneksi ke database
    const connection = await mysql.createConnection(dbConfig);
    const device = req.query.device;

    let response, sql, query;
    // json response format
    if (device == "all") {
      response = {
        status: "success",
        data: {},
        summary: {
          total: {},
        },
        label: ["Device 1", "Device 2"],
      };
    } else {
      response = {
        status: "success",
        data: {},
        summary: {
          total: {},
        },
        label: ["Watt Hour Cost"],
      };
    }

    // Query untuk mendapatkan data penggunaan listrik per hari dan total penggunaan listrik
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

    // Eksekusi query
    const [result] = await connection.execute(sql);
    const [result2] = await connection.execute(query);
    const result2Value = [result2[0].value1, result2[0].value2];

    // Menyusun response data
    response.data = result;
    response.summary.total = result2Value;

    // Menutup koneksi ke database
    await connection.end();

    // Mengirimkan data sebagai respons
    res.json(response);
  } catch (error) {
    console.error("Error fetching data from database:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/kw_month", async (req, res) => {
  try {
    // Membuat koneksi ke database
    const connection = await mysql.createConnection(dbConfig);
    const device = req.query.device;

    let response, sql, query;
    // json response format
    if (device == "all") {
      response = {
        status: "success",
        data: {},
        summary: {
          total: {},
        },
        label: ["Device 1", "Device 2"],
      };
    } else {
      response = {
        status: "success",
        data: {},
        summary: {
          total: {},
        },
        label: ["Watt Hour Cost"],
      };
    }

    // Query untuk mendapatkan data penggunaan listrik per bulan dan total penggunaan listrik
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

    // Eksekusi query
    const [result] = await connection.execute(sql);
    const [result2] = await connection.execute(query);
    const result2Value = [result2[0].value1, result2[0].value2];

    // Menyusun response data
    response.data = result;
    response.summary.total = result2Value;

    // Menutup koneksi ke database
    await connection.end();

    // Mengirimkan data sebagai respons
    res.json(response);
  } catch (error) {
    console.error("Error fetching data from database:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/kw_custom", async (req, res) => {
  try {
    // Membuat koneksi ke database
    const connection = await mysql.createConnection(dbConfig);
    const device = req.query.device;

    let response, sql, query;
    // json response format
    if (device == "all") {
      response = {
        status: "success",
        data: {},
        summary: {
          total: {},
        },
        label: ["Device 1", "Device 2"],
      };
    } else {
      response = {
        status: "success",
        data: {},
        summary: {
          total: {},
        },
        label: ["Watt Hour Cost"],
      };
    }

    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    // Query untuk mendapatkan data penggunaan listrik sesuai rentang tanggal yang diminta
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

    // Menutup koneksi ke database
    await connection.end();

    // Mengirimkan data sebagai respons
    res.json(response);
  } catch (error) {
    console.error("Error fetching data from database:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/dashboard", async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    let response, sql, query;

    response = {
      status: "success",
      data: {},
      summary: {
        total: {},
      },
      label: ["Device 1", "Device 2"],
    };

    sql = `
    SELECT
      (SELECT SUM(kw) as kw FROM power_meter WHERE DATE(timestamp) = CURDATE() and no_device = 1) AS value1,
      (SELECT SUM(kw) as kw FROM power_meter WHERE DATE(timestamp) = CURDATE() and no_device = 2) AS value2,
      (SELECT SUM(kw) as kw FROM power_meter WHERE DATE(timestamp) = CURDATE() and no_device = 3) AS value3
    `;

    // Eksekusi query utama
    const [result] = await connection.execute(sql, params);

    // Eksekusi query tambahan untuk summary
    // const [totalResult] = await connection.execute(totalQuery, params);

    // Transform the totalResult and avgResult to arrays of values
    // const totalValues = [
    //   totalResult[0].value1,
    //   totalResult[0].value2,
    //   totalResult[0].value3,
    // ];

    response.data = result;
    // response.summary.total = totalValues;

    await connection.end();
    res.json(response);
  } catch (error) {}
});

// Menjalankan server
app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});
