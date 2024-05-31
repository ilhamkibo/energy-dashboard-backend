const db = require("../config/db.config");

async function insertData(data) {
  const connection = await db.getConnection();

  try {
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
