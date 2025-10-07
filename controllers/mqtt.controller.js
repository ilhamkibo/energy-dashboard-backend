// const mqtt = require("mqtt");
// const dataModel = require("../models/data.model");

// const client = mqtt.connect("mqtt://broker.emqx.io:1883");

// client.on("connect", () => {
//   console.log("MQTT connected");
// });

// client.subscribe("PM/E5").on("message", async (topic, payload) => {
//   try {
//     const data = JSON.parse(payload);
//     const now = Date.now();
//     console.log("🚀 ~ data:", data.PME5[0].data, now);

//     // await dataModel.insertData(data);
//   } catch (error) {
//     console.error("Error parsing JSON or inserting data:", error);
//   }
// });

const mqtt = require("mqtt");
const dataModel = require("../models/data.model");

const client = mqtt.connect("mqtt://broker.emqx.io:1883");

let latestData = null; // 🧠 buffer untuk data terakhir
let lastInsertTime = 0;

client.on("connect", () => {
  console.log("✅ MQTT connected");
  client.subscribe("PM/E5");
});

// 📨 Terima data dari MQTT (setiap detik)
client.on("message", (topic, payload) => {
  if (topic !== "PM/E5") return;

  try {
    const data = JSON.parse(payload.toString());
    latestData = data; // simpan data terbaru di buffer
    // console.log("📩 Data received:", data.PME5[0].data);
  } catch (error) {
    console.error("❌ Error parsing JSON:", error);
  }
});

// 🕒 Simpan data tiap 10 detik
setInterval(async () => {
  if (!latestData) return; // belum ada data masuk

  const now = Date.now();
  const diff = now - lastInsertTime;

  // hanya insert jika sudah lewat 10 detik
  if (diff >= 10_000) {
    try {
      await dataModel.insertData(latestData);
      console.log("✅ Data inserted at", new Date().toLocaleTimeString());
      lastInsertTime = now;
      latestData = null; // reset buffer
    } catch (err) {
      console.error("❌ Error inserting data:", err);
    }
  }
}, 1000); // cek setiap 1 detik
