const db = require("../config/db.config");

// Helper: generate random float
function randomFloat(min, max, decimals = 3) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

// Helper: parsing angka dari string "[0.214]" atau "[0,26]"
function parseNumber(value) {
  if (!value) return 0;
  return parseFloat(value.replace("[", "").replace("]", "").replace(",", "."));
}

async function insertData(data) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // ✅ Ambil data dari MQTT
    const payload = data.PME5 || [];

    // Filter data asli
    const pmData = payload.filter((d) => d.server_name === "PM2100");
    const tempData = payload.find((d) => d.server_name === "E5CC");

    // === POWERMETER 1 (data asli) ===
    const voltage = parseNumber(pmData.find((d) => d.name === "Voltage")?.data);
    const ampere = parseNumber(pmData.find((d) => d.name === "Ampere")?.data);
    const kw = parseNumber(pmData.find((d) => d.name === "kWh")?.data);
    const pf = parseNumber(pmData.find((d) => d.name === "PowerFactor")?.data);
    const kva = parseNumber(pmData.find((d) => d.name === "kVArh")?.data);
    const freq = parseNumber(pmData.find((d) => d.name === "Frequency")?.data);

    const powermeter1 = {
      no_device: 1,
      kva,
      kw,
      volt1: voltage,
      volt2: voltage + randomFloat(-1, 1),
      volt3: voltage + randomFloat(-1, 1),
      amp1: ampere,
      amp2: ampere + randomFloat(-0.05, 0.05),
      amp3: ampere + randomFloat(-0.05, 0.05),
      freq,
    };

    // === POWERMETER 2 & 3 (dummy) ===
    function generatePowerMeterDummy(index) {
      const volt1 = randomFloat(220, 230);
      const volt2 = randomFloat(220, 230);
      const volt3 = randomFloat(220, 230);
      const amp1 = randomFloat(0.2, 0.6);
      const amp2 = randomFloat(0.2, 0.6);
      const amp3 = randomFloat(0.2, 0.6);
      const kw = randomFloat(0.5, 2.5);
      const kva = parseFloat((kw / randomFloat(0.8, 1)).toFixed(3));
      const freq = randomFloat(49.8, 50.2);

      return {
        no_device: index,
        kva,
        kw,
        volt1,
        volt2,
        volt3,
        amp1,
        amp2,
        amp3,
        freq,
      };
    }

    const powermeter2 = generatePowerMeterDummy(2);
    const powermeter3 = generatePowerMeterDummy(3);

    const powerMeters = [powermeter1, powermeter2, powermeter3];

    // === TEMPERATURE ===
    const temp1 = parseNumber(tempData?.data);
    const temp2 = randomFloat(25, 50, 1);
    const temperatures = [
      { no_device: 1, temp: temp1 },
      { no_device: 2, temp: temp2 },
    ];

    // console.log(powerMeters, temperatures);
    // ✅ INSERT ke power_meter
    for (const p of powerMeters) {
      const query = `
        INSERT INTO power_meter
        (no_device, kva, kw, volt1, volt2, volt3, amp1, amp2, amp3, freq, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `;
      const params = [
        p.no_device,
        p.kva,
        p.kw,
        p.volt1,
        p.volt2,
        p.volt3,
        p.amp1,
        p.amp2,
        p.amp3,
        p.freq,
      ];

      await connection.execute(query, params);
      // console.log(`✅ Data inserted for ${p.no_device}`);
    }

    // ✅ INSERT ke temp_control
    for (const t of temperatures) {
      const query = `
        INSERT INTO temp_control (no_device, temp, timestamp)
        VALUES (?, ?, NOW())
      `;
      const params = [t.no_device, t.temp];

      await connection.execute(query, params);
      // console.log(`🌡️ Temperature data inserted for ${t.no_device}`);
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error("Error inserting data:", error);
  } finally {
    connection.release();
  }
}

function extractNumber(deviceName) {
  const match = deviceName.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

module.exports = {
  insertData,
  extractNumber,
};
