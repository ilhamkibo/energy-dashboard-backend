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
          timestamp BIGINT
      );
  `;

  const createTempControlTable = `
      CREATE TABLE IF NOT EXISTS temp_control (
          id INT AUTO_INCREMENT PRIMARY KEY,
          no_device INT,
          temp FLOAT,
          timestamp BIGINT
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
          acc["timestamp"] = value.timestamp;
          return acc;
        }, {});

        const query = `
                  INSERT INTO power_meter (no_device, kva, kw, volt1, volt2, volt3, amp1, amp2, amp3, freq, timestamp)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          values.timestamp,
        ];

        await connection.execute(query, params);

        console.log(`Data for Power Meter ${noDevice} inserted successfully.`);
      } else if (deviceName.startsWith("Temperature")) {
        for (const value of device.values) {
          const query = `
                      INSERT INTO temp_control (no_device, temp, timestamp)
                      VALUES (?, ?, ?)
                  `;
          const params = [noDevice, value.raw_data, value.timestamp];

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

    //json response format
    const response = {
      status: "success",
      data: {},
      label: ["Volt 1", "Volt 2", "Volt 3"],
    };

    let sql;
    let params = [];

    if (req.query.endDate) {
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;

      sql = `
        SELECT * FROM (
          SELECT
            DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
            AVG(volt3) AS value3,
            AVG(volt2) AS value2,
            AVG(volt1) AS value1
          FROM logs
          WHERE DATE(timestamp) BETWEEN ? AND ?
          GROUP BY DATE(timestamp)
          ORDER BY timestamp DESC
          LIMIT 250
        ) AS subquery
        ORDER BY timestamp ASC;
      `;
      params = [startDate, endDate];
    } else {
      if (req.query.date === "month") {
        // Query untuk mendapatkan rata-rata harian untuk bulan ini
        sql = `
        SELECT * FROM (
          SELECT
            DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
            AVG(volt3) AS value3,
            AVG(volt2) AS value2,
            AVG(volt1) AS value1
          FROM logs
          WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE())
          GROUP BY DATE(timestamp)
          ORDER BY timestamp DESC
          LIMIT 250
        ) AS subquery
        ORDER BY timestamp ASC;
        `;
      } else if (req.query.date === "year") {
        // Query untuk mendapatkan rata-rata bulanan untuk tahun ini
        sql = `
        SELECT * FROM (
          SELECT
            DATE_FORMAT(timestamp, '%Y-%m') AS timestamp,
            AVG(volt3) AS value3,
            AVG(volt2) AS value2,
            AVG(volt1) AS value1
          FROM logs
          WHERE YEAR(timestamp) = YEAR(CURDATE())
          GROUP BY YEAR(timestamp), MONTH(timestamp)
          ORDER BY timestamp DESC
          LIMIT 12
        ) AS subquery
        ORDER BY timestamp ASC;
        `;
      } else {
        // Default: Query untuk mendapatkan data hari ini
        sql = `
        SELECT *
        FROM (
            SELECT volt3 as value3, volt2 as value2, volt1 as value1, DATE_FORMAT(timestamp, '%H:%i:%s') AS timestamp
            FROM logs
            WHERE DATE(timestamp) = CURDATE()
            ORDER BY timestamp DESC
            LIMIT 250
        ) AS subquery
        ORDER BY timestamp ASC;
        `;
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

    //json response format
    const response = {
      status: "success",
      data: {},
      label: ["Current 1", "Current 2", "Current 3"],
    };

    let sql;
    let params = [];

    if (req.query.endDate) {
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;

      sql = `
        SELECT * FROM (
          SELECT
            DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
            AVG(amp3) AS value3,
            AVG(amp2) AS value2,
            AVG(amp1) AS value1
          FROM logs
          WHERE DATE(timestamp) BETWEEN ? AND ?
          GROUP BY DATE(timestamp)
          ORDER BY timestamp DESC
          LIMIT 250
        ) AS subquery
        ORDER BY timestamp ASC;
      `;
      params = [startDate, endDate];
    } else {
      if (req.query.date === "month") {
        // Query untuk mendapatkan rata-rata harian untuk bulan ini
        sql = `
          SELECT * FROM (
            SELECT
              DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
              AVG(amp3) AS value3,
              AVG(amp2) AS value2,
              AVG(amp1) AS value1
            FROM logs
            WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE())
            GROUP BY DATE(timestamp)
            ORDER BY timestamp DESC
          ) AS subquery
          ORDER BY timestamp ASC;
        `;
      } else if (req.query.date === "year") {
        // Query untuk mendapatkan rata-rata bulanan untuk tahun ini
        sql = `
          SELECT * FROM (
            SELECT
              DATE_FORMAT(timestamp, '%Y-%m') AS timestamp,
              AVG(amp3) AS value3,
              AVG(amp2) AS value2,
              AVG(amp1) AS value1
            FROM logs
            WHERE YEAR(timestamp) = YEAR(CURDATE())
            GROUP BY YEAR(timestamp), MONTH(timestamp)
            ORDER BY timestamp DESC
            LIMIT 12
          ) AS subquery
          ORDER BY timestamp ASC;
        `;
      } else {
        // Default: Query untuk mendapatkan data hari ini
        sql = `
          SELECT *
          FROM (
            SELECT amp3 as value3, amp2 as value2, amp1 as value1, DATE_FORMAT(timestamp, '%H:%i:%s') AS timestamp
            FROM logs
            WHERE DATE(timestamp) = CURDATE()
            ORDER BY timestamp DESC
            LIMIT 250
          ) AS subquery
          ORDER BY timestamp ASC;
        `;
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

    // json response format
    const response = {
      status: "success",
      data: {},
      label: ["Watt"],
    };

    let sql, query;
    let params = [];
    if (req.query.endDate) {
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;

      sql = `
        SELECT * FROM (
          SELECT
            DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
            SUM(kw) AS value
          FROM logs
          WHERE DATE(timestamp) BETWEEN ? AND ?
          GROUP BY DATE(timestamp)
          ORDER BY timestamp DESC
          LIMIT 250
        ) AS subquery
        ORDER BY timestamp ASC;
      `;

      query = `
        SELECT
          SUM(kW) AS total_kW,
          AVG(kW) AS avg_kW
        FROM logs
        WHERE DATE(timestamp) BETWEEN ? AND ?
      `;

      params = [startDate, endDate];
    } else {
      if (req.query.date === "month") {
        // Query untuk mendapatkan rata-rata harian untuk bulan ini
        sql = `
          SELECT * FROM (
            SELECT
              DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
              SUM(kw) AS value
            FROM logs
            WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE())
            GROUP BY DATE(timestamp)
            ORDER BY timestamp DESC
          ) AS subquery
          ORDER BY timestamp ASC;
        `;

        query = `
          SELECT
            SUM(kW) AS total_kW,
            AVG(kW) AS avg_kW
          FROM logs
          WHERE YEAR(timestamp) = YEAR(CURDATE()) AND MONTH(timestamp) = MONTH(CURDATE())
        `;
      } else if (req.query.date === "year") {
        // Query untuk mendapatkan rata-rata bulanan untuk tahun ini
        sql = `
          SELECT * FROM (
            SELECT
              DATE_FORMAT(timestamp, '%Y-%m') AS timestamp,
              SUM(kw) AS value
            FROM logs
            WHERE YEAR(timestamp) = YEAR(CURDATE())
            GROUP BY YEAR(timestamp), MONTH(timestamp)
            ORDER BY timestamp
            LIMIT 12
          ) AS subquery
          ORDER BY timestamp ASC;
        `;

        query = `
          SELECT
            SUM(kW) AS total_kW,
            AVG(kW) AS avg_kW
          FROM logs
          WHERE YEAR(timestamp) = YEAR(CURDATE())
        `;
      } else {
        // Default: Query untuk mendapatkan data hari ini
        sql = `
          SELECT * FROM (
            SELECT kw AS value, DATE_FORMAT(timestamp, '%H:%i:%s') AS timestamp
            FROM logs
            WHERE DATE(timestamp) = CURDATE()
            ORDER BY timestamp DESC
            LIMIT 250
          ) AS subquery
          ORDER BY timestamp ASC;
        `;

        query = `
          SELECT
            SUM(kW) AS total_kW,
            AVG(kW) AS avg_kW
          FROM logs
          WHERE DATE(timestamp) = CURDATE()
        `;
      }
    }

    // Eksekusi query utama
    const [result] = await connection.execute(sql, params);

    // Eksekusi query tambahan untuk summary
    const [summaryResult] = await connection.execute(query, params);

    // Mengatur data response
    response.data = result;
    response.summary = summaryResult[0];

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

    // json response format
    const response = {
      status: "success",
      data: {},
      label: ["Frequency"],
    };

    let sql;
    let params = [];

    if (req.query.endDate) {
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;

      sql = `
        SELECT * FROM (
          SELECT
            DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
            AVG(frequency) AS value
          FROM logs
          WHERE DATE(timestamp) BETWEEN ? AND ?
          GROUP BY DATE(timestamp)
          ORDER BY timestamp DESC
          LIMIT 250
        ) AS subquery
        ORDER BY timestamp ASC;
      `;
      params = [startDate, endDate];
    } else {
      if (req.query.date === "month") {
        // Query untuk mendapatkan rata-rata harian untuk bulan ini
        sql = `
          SELECT * FROM (
            SELECT
              DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
              AVG(frequency) AS value
            FROM logs
            WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE())
            GROUP BY DATE(timestamp)
            ORDER BY timestamp DESC
          ) AS subquery
          ORDER BY timestamp ASC;
        `;
      } else if (req.query.date === "year") {
        // Query untuk mendapatkan rata-rata bulanan untuk tahun ini
        sql = `
          SELECT * FROM (
            SELECT
              DATE_FORMAT(timestamp, '%Y-%m') AS timestamp,
              AVG(frequency) AS value
            FROM logs
            WHERE YEAR(timestamp) = YEAR(CURDATE())
            GROUP BY YEAR(timestamp), MONTH(timestamp)
            ORDER BY timestamp DESC
            LIMIT 12
          ) AS subquery
          ORDER BY timestamp ASC;
        `;
      } else {
        // Default: Query untuk mendapatkan data hari ini
        sql = `
          SELECT * FROM (
            SELECT frequency AS value, DATE_FORMAT(timestamp, '%H:%i:%s') AS timestamp
            FROM logs
            WHERE DATE(timestamp) = CURDATE()
            ORDER BY timestamp DESC
            LIMIT 250
          ) AS subquery
          ORDER BY timestamp ASC;
        `;
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

app.get("/kva", async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);

    // json response format
    const response = {
      status: "success",
      data: {},
      label: ["Frequency"],
    };

    let sql;
    let params = [];

    if (req.query.endDate) {
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;

      sql = `
        SELECT * FROM (
          SELECT
            DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
            sum(kva) AS value
          FROM logs
          WHERE DATE(timestamp) BETWEEN ? AND ?
          GROUP BY DATE(timestamp)
          ORDER BY timestamp DESC
          LIMIT 250
        ) AS subquery
        ORDER BY timestamp ASC;
        `;

      params = [startDate, endDate];
    } else {
      if (req.query.date === "month") {
        // Query untuk mendapatkan rata-rata harian untuk bulan ini
        sql = `
          select * from (SELECT
            DATE_FORMAT(timestamp, '%Y-%m-%d') as timestamp,
            AVG(kva) AS value
            FROM logs
            WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE())
            GROUP BY DATE(timestamp)
            ORDER BY timestamp DESC) as subquery order by timestamp asc
        `;
      } else if (req.query.date === "year") {
        // Query untuk mendapatkan rata-rata bulanan untuk tahun ini
        sql = `
          select * from (SELECT
            YEAR(timestamp) AS year,
            MONTH(timestamp) AS month,
            DATE_FORMAT(timestamp, '%Y-%m') as timestamp,
            AVG(kva) AS value
          FROM logs
          WHERE YEAR(timestamp) = YEAR(CURDATE())
          GROUP BY YEAR(timestamp), MONTH(timestamp)
          ORDER BY year DESC, month DESC
          LIMIT 12) as subquery order by timestamp asc
        `;
      } else {
        // Default: Query untuk mendapatkan data hari ini
        sql = `
          select * from (SELECT kva as value, DATE_FORMAT(timestamp, '%H:%i:%s') as timestamp
          FROM logs
          WHERE DATE(timestamp) = CURDATE() order by timestamp desc limit 250) as subquery order by timestamp asc
        `;
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

    // json response format
    const response = {
      status: "success",
      data: {},
      label: ["Temperature"],
    };

    let sql;
    let params = [];

    if (req.query.endDate) {
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;

      sql = `
        SELECT * FROM (
          SELECT
            DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
            AVG(temp) AS value
          FROM logs
          WHERE DATE(timestamp) BETWEEN ? AND ?
          GROUP BY DATE(timestamp)
          ORDER BY timestamp DESC
          LIMIT 250
        ) AS subquery
        ORDER BY timestamp ASC;
      `;
      params = [startDate, endDate];
    } else {
      if (req.query.date === "month") {
        // Query untuk mendapatkan rata-rata harian untuk bulan ini
        sql = `
          SELECT * FROM (
            SELECT
              DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
              AVG(temp) AS value
            FROM logs
            WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE())
            GROUP BY DATE(timestamp)
            ORDER BY timestamp DESC
          ) AS subquery
          ORDER BY timestamp ASC;
        `;
      } else if (req.query.date === "year") {
        // Query untuk mendapatkan rata-rata bulanan untuk tahun ini
        sql = `
          SELECT * FROM (
            SELECT
              DATE_FORMAT(timestamp, '%Y-%m') AS timestamp,
              AVG(temp) AS value
            FROM logs
            WHERE YEAR(timestamp) = YEAR(CURDATE())
            GROUP BY YEAR(timestamp), MONTH(timestamp)
            ORDER BY timestamp DESC
            LIMIT 12
          ) AS subquery
          ORDER BY timestamp ASC;
        `;
      } else {
        // Default: Query untuk mendapatkan data hari ini
        sql = `
          SELECT * FROM (
            SELECT temp AS value, DATE_FORMAT(timestamp, '%H:%i:%s') AS timestamp
            FROM logs
            WHERE DATE(timestamp) = CURDATE()
            ORDER BY timestamp DESC
            LIMIT 250
          ) AS subquery
          ORDER BY timestamp ASC;
        `;
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

    // json response format
    const response = {
      status: "success",
      data: {},
      label: ["Watt Hour Cost"],
    };

    // Query untuk mendapatkan data penggunaan listrik per jam dan total penggunaan listrik
    const sql = `
      SELECT DATE_FORMAT(timestamp, '%H:00-%H:59') AS timestamp,
             SUM(kw * 1300 / 1000) AS value
      FROM logs
      WHERE DATE(timestamp) = CURDATE()
      GROUP BY HOUR(timestamp)
      ORDER BY HOUR(timestamp);
    `;

    const query = `
      SELECT DATE_FORMAT(timestamp, '%H:00-%H:59') AS timestamp,
             SUM(kw * 1300 / 1000) AS total_kW
      FROM logs
      WHERE DATE(timestamp) = CURDATE()
      ORDER BY HOUR(timestamp);
    `;

    // Eksekusi query
    const [result] = await connection.execute(sql);
    const [result2] = await connection.execute(query);

    // Menyusun response data
    response.data = result;
    response.summary = result2[0];

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

    // json response format
    const response = {
      status: "success",
      data: {},
      label: ["Watt Day Cost"],
    };

    // Query untuk mendapatkan data penggunaan listrik per hari dan total penggunaan listrik
    const sql = `
      SELECT DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
             SUM(kw * 1300 / 1000) AS value
      FROM logs
      WHERE MONTH(timestamp) = MONTH(CURDATE())
      GROUP BY DATE(timestamp)
      ORDER BY DATE(timestamp);
    `;

    const query = `
      SELECT DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
             SUM(kw * 1300 / 1000) AS total_kW
      FROM logs
      WHERE MONTH(timestamp) = MONTH(CURDATE())
      ORDER BY DATE(timestamp);
    `;

    // Eksekusi query
    const [result] = await connection.execute(sql);
    const [result2] = await connection.execute(query);

    // Menyusun response data
    response.data = result;
    response.summary = result2[0];

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

    // json response format
    const response = {
      status: "success",
      data: {},
      label: ["Watt Month Cost"],
    };

    // Query untuk mendapatkan data penggunaan listrik per bulan dan total penggunaan listrik
    const sql = `
      SELECT DATE_FORMAT(timestamp, '%Y-%m') AS timestamp,
             SUM(kw * 1300 / 1000) AS value
      FROM logs
      WHERE YEAR(timestamp) = YEAR(CURDATE())
      GROUP BY MONTH(timestamp)
      ORDER BY MONTH(timestamp);
    `;

    const query = `
      SELECT DATE_FORMAT(timestamp, '%Y-%m') AS timestamp,
             SUM(kw * 1300 / 1000) AS total_kW
      FROM logs
      WHERE YEAR(timestamp) = YEAR(CURDATE())
      ORDER BY MONTH(timestamp);
    `;

    // Eksekusi query
    const [result] = await connection.execute(sql);
    const [result2] = await connection.execute(query);

    // Menyusun response data
    response.data = result;
    response.summary = result2[0];

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

    // json response format
    const response = {
      status: "success",
      data: {},
      label: ["Watt Month Cost"],
    };

    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    // Query untuk mendapatkan data penggunaan listrik sesuai rentang tanggal yang diminta
    const sql = `
      SELECT * FROM (
        SELECT
          DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
          SUM(kw) AS value
        FROM logs
        WHERE DATE(timestamp) BETWEEN ? AND ?
        GROUP BY DATE(timestamp)
        ORDER BY timestamp DESC
        LIMIT 250
      ) AS subquery
      ORDER BY timestamp ASC;
    `;

    // Query untuk mendapatkan total penggunaan listrik dan rata-rata penggunaan listrik sesuai rentang tanggal yang diminta
    const query = `
      SELECT DATE_FORMAT(timestamp, '%Y-%m') AS timestamp,
        SUM(kW) AS total_kW,
        AVG(kw) AS avg_kW
      FROM logs
      WHERE DATE(timestamp) BETWEEN ? AND ?
      ORDER BY timestamp;
    `;

    // Eksekusi query
    const [result] = await connection.execute(sql, [startDate, endDate]);
    const [result2] = await connection.execute(query, [startDate, endDate]);

    // Menyusun response data
    response.data = result;
    response.summary = result2[0];

    // Menutup koneksi ke database
    await connection.end();

    // Mengirimkan data sebagai respons
    res.json(response);
  } catch (error) {
    console.error("Error fetching data from database:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Menjalankan server
app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});
