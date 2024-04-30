const mqtt = require("mqtt");
const mysql = require("mysql2");
const express = require("express");
const app = express();
const port = 3002;
const util = require("util");

const client = mqtt.connect("mqtt://103.181.142.170:1883");

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

client.on("connect", () => {
  console.log("mqtt connected");
});

client.subscribe("toho").on("message", (topic, payload) => {
  try {
    // console.log("🚀 ~ client.subscribe ~ payload:", payload);
    const data = JSON.parse(payload);
    console.log("🚀 ~ client.subscribe ~ data:", data);
    const raw_data_array = [];

    // Iterasi melalui setiap parameter dan nilai raw_data
    data.data.forEach((item) => {
      item.values.forEach((value) => {
        raw_data_array.push(value.raw_data);
      });
    });
    console.log(raw_data_array);

    // Memanggil fungsi insertDB dengan raw_data_array
    insertDB(raw_data_array)
      .then(() => {
        console.log("Data inserted successfully " + new Date());
      })
      .catch((error) => {
        console.error("Error inserting data:", error);
      });
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

    // Menggunakan promisify untuk mengubah callback ke Promise
    const queryAsync = util.promisify(connection.query).bind(connection);

    //json response format
    const response = {
      status: "success",
      data: {},
      label: ["Volt 1", "Volt 2", "Volt 3"],
    };

    let sql;
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
        LIMIT 500
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
          LIMIT 500
      ) AS subquery
      ORDER BY timestamp ASC;
      `;
    }

    const result = await queryAsync(sql);
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

    // Menggunakan promisify untuk mengubah callback ke Promise
    const queryAsync = util.promisify(connection.query).bind(connection);

    //json response format
    const response = {
      status: "success",
      data: {},
      label: ["Current 1", "Current 2", "Current 3"],
    };

    let sql;
    if (req.query.date === "month") {
      // Query untuk mendapatkan rata-rata harian untuk bulan ini
      sql = `
        select * from (SELECT
        DATE_FORMAT(timestamp, '%Y-%m-%d') AS timestamp,
          AVG(amp3) AS value3,
          AVG(amp2) AS value2,
          AVG(amp1) AS value1
        FROM logs
        WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE())
        GROUP BY DATE(timestamp)
        ORDER BY timestamp DESC) as subquery ORDER BY timestamp ASC
      `;
    } else if (req.query.date === "year") {
      // Query untuk mendapatkan rata-rata bulanan untuk tahun ini
      sql = `
        select * from (
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
        ) as subquery ORDER BY timestamp ASC;
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
          LIMIT 500
      ) AS subquery
      ORDER BY timestamp ASC;
      `;
    }

    const result = await queryAsync(sql);
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

    // Menggunakan promisify untuk mengubah callback ke Promise
    const queryAsync = util.promisify(connection.query).bind(connection);

    //json response format
    const response = {
      status: "success",
      data: {},
      label: ["Watt"],
    };

    let sql, query;
    if (req.query.date === "month") {
      // Query untuk mendapatkan rata-rata harian untuk bulan ini
      sql = `
        select * from (
          SELECT
        DATE_FORMAT(timestamp, '%Y-%m-%d') as timestamp,
        AVG(kw) AS value
        FROM logs
        WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE())
        GROUP BY DATE(timestamp)
        ORDER BY timestamp DESC
        ) as subquery order by timestamp asc
      `;
      query = `
        SELECT DATE_FORMAT(timestamp, '%Y-%m') AS tanggal,
          SUM(kW) AS total_kW,
          AVG(kw) AS avg_kW
        FROM logs
        WHERE YEAR(timestamp) = YEAR(CURDATE()) AND MONTH(timestamp) = MONTH(CURDATE())
        ORDER BY tanggal;
      `;
    } else if (req.query.date === "year") {
      // Query untuk mendapatkan rata-rata bulanan untuk tahun ini
      sql = `
        select * from (SELECT
          YEAR(timestamp) AS year,
          MONTH(timestamp) AS month,
          DATE_FORMAT(timestamp, '%Y-%m') as timestamp,
          AVG(kw) AS value
        FROM logs
        WHERE YEAR(timestamp) = YEAR(CURDATE())
        GROUP BY YEAR(timestamp), MONTH(timestamp)
        ORDER BY timestamp
        LIMIT 12) as subquery order by timestamp asc
      `;
      query = `
        SELECT DATE_FORMAT(timestamp, '%Y') AS tanggal,
          SUM(kW) AS total_kW,
          AVG(kw) AS avg_kW
        FROM logs
        WHERE YEAR(timestamp) = YEAR(CURDATE())
        ORDER BY tanggal;
      `;
    } else {
      // Default: Query untuk mendapatkan data hari ini
      sql = `
        select * from (SELECT kw as value, DATE_FORMAT(timestamp, '%H:%i:%s') as timestamp
        FROM logs
        WHERE DATE(timestamp) = CURDATE() order by timestamp desc limit 500) as subquery order by timestamp asc
      `;

      query = `SELECT SUM(kW) AS total_kW, AVG(kW) AS avg_kW FROM logs WHERE DATE(timestamp) = CURDATE()`;
    }

    const result = await queryAsync(sql);
    const result2 = await queryAsync(query);
    console.log("🚀 ~ app.get ~ result2:", result2);
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

app.get("/frequency", async (req, res) => {
  try {
    // Membuat koneksi ke database
    const connection = await mysql.createConnection(dbConfig);

    // Menggunakan promisify untuk mengubah callback ke Promise
    const queryAsync = util.promisify(connection.query).bind(connection);

    //json response format
    const response = {
      status: "success",
      data: {},
      label: ["Frequency"],
    };

    let sql;
    if (req.query.date === "month") {
      // Query untuk mendapatkan rata-rata harian untuk bulan ini
      sql = `
        select * from (SELECT
          DATE_FORMAT(timestamp, '%Y-%m-%d') as timestamp,
          AVG(frequency) AS value
        FROM logs
        WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE())
        GROUP BY DATE(timestamp)
        ORDER BY timestamp DESC) as subquery order by timestamp asc
      `;
    } else if (req.query.date === "year") {
      // Query untuk mendapatkan rata-rata bulanan untuk tahun ini
      sql = `
        select * from (SELECT
          DATE_FORMAT(timestamp, '%Y-%m') as timestamp,
          AVG(frequency) AS value
        FROM logs
        WHERE YEAR(timestamp) = YEAR(CURDATE())
        GROUP BY YEAR(timestamp), MONTH(timestamp)
        ORDER BY timestamp DESC
        LIMIT 12) as subquery order by timestamp asc
      `;
    } else {
      // Default: Query untuk mendapatkan data hari ini
      sql = `
        select * from (SELECT frequency as value, DATE_FORMAT(timestamp, '%H:%i:%s') as timestamp
        FROM logs
        WHERE DATE(timestamp) = CURDATE() order by timestamp desc limit 500) as subquery order by timestamp asc
      `;
    }

    const result = await queryAsync(sql);
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
    // Membuat koneksi ke database
    const connection = await mysql.createConnection(dbConfig);

    // Menggunakan promisify untuk mengubah callback ke Promise
    const queryAsync = util.promisify(connection.query).bind(connection);

    //json response format
    const response = {
      status: "success",
      data: {},
      label: ["KVA"],
    };

    let sql;
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
        WHERE DATE(timestamp) = CURDATE() order by timestamp desc limit 500) as subquery order by timestamp asc
      `;
    }

    const result = await queryAsync(sql);
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

    // Menggunakan promisify untuk mengubah callback ke Promise
    const queryAsync = util.promisify(connection.query).bind(connection);

    //json response format
    const response = {
      status: "success",
      data: {},
      label: ["Temperature"],
    };

    let sql;
    if (req.query.date === "month") {
      // Query untuk mendapatkan rata-rata harian untuk bulan ini
      sql = `
        select * from(SELECT
          DATE_FORMAT(timestamp, '%Y-%m-%d') as timestamp,
            AVG(temp) AS value
          FROM logs
          WHERE MONTH(timestamp) = MONTH(CURDATE()) AND YEAR(timestamp) = YEAR(CURDATE())
          GROUP BY DATE(timestamp)
          ORDER BY timestamp DESC) as subquery order by timestamp asc
      `;
    } else if (req.query.date === "year") {
      // Query untuk mendapatkan rata-rata bulanan untuk tahun ini
      sql = `
        select * from (SELECT
          DATE_FORMAT(timestamp, '%Y-%m') as timestamp,
          AVG(temp) AS value
        FROM logs
        WHERE YEAR(timestamp) = YEAR(CURDATE())
        GROUP BY YEAR(timestamp), MONTH(timestamp)
        ORDER BY timestamp DESC
        LIMIT 12) as subquery order by timestamp asc
      `;
    } else {
      // Default: Query untuk mendapatkan data hari ini
      sql = `
        select * from (SELECT temp as value, DATE_FORMAT(timestamp, '%H:%i:%s') as timestamp
        FROM logs
        WHERE DATE(timestamp) = CURDATE() order by timestamp desc limit 500) as subquery order by timestamp asc
      `;
    }

    const result = await queryAsync(sql);
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

    // Menggunakan promisify untuk mengubah callback ke Promise
    const queryAsync = util.promisify(connection.query).bind(connection);

    //json response format
    const response = {
      status: "success",
      data: {},
    };

    const sql =
      "SELECT DATE_FORMAT(timestamp, '%H:00-%H:59') as timestamp, SUM(kw * 10 / 3600 * 1300) AS hourly_cost FROM logs WHERE DATE(timestamp) = CURDATE() GROUP BY HOUR(timestamp) ORDER BY HOUR(timestamp)";

    const result = await queryAsync(sql);
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

app.get("/kw_day", async (req, res) => {
  try {
    // Membuat koneksi ke database
    const connection = await mysql.createConnection(dbConfig);

    // Menggunakan promisify untuk mengubah callback ke Promise
    const queryAsync = util.promisify(connection.query).bind(connection);

    //json response format
    const response = {
      status: "success",
      data: [
        {
          timestamp: "17:00-17:59",
          day_cost: 0,
        },
        {
          timestamp: "18:00-18:59",
          day_cost: 0,
        },
      ],
    };
    // const response = {
    //   status: "success",
    //   data: {},
    // };

    const sql =
      "SELECT DATE_FORMAT(timestamp, '%H:00-%H:59') as timestamp, SUM(kw * 10 / 3600 * 1300) AS hourly_cost FROM logs WHERE DATE(timestamp) = CURDATE() GROUP BY HOUR(timestamp) ORDER BY HOUR(timestamp)";

    const result = await queryAsync(sql);
    // response.data = result;

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

    // Menggunakan promisify untuk mengubah callback ke Promise
    const queryAsync = util.promisify(connection.query).bind(connection);

    //json response format
    // const response = {
    //   status: "success",
    //   data: {},
    // };
    const response = {
      status: "success",
      data: [
        {
          timestamp: "17:00-17:59",
          month_cost: 0,
        },
        {
          timestamp: "18:00-18:59",
          month_cost: 0,
        },
      ],
    };

    const sql =
      "SELECT DATE_FORMAT(timestamp, '%H:00-%H:59') as timestamp, SUM(kw * 10 / 3600 * 1300) AS hourly_cost FROM logs WHERE DATE(timestamp) = CURDATE() GROUP BY HOUR(timestamp) ORDER BY HOUR(timestamp)";

    const result = await queryAsync(sql);
    // response.data = result;

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
