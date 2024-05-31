const mqtt = require("mqtt");
const dataModel = require("../models/data.model");

const client = mqtt.connect("mqtt://broker.emqx.io:1883");

client.on("connect", () => {
  console.log("MQTT connected");
});

client.subscribe("toho").on("message", async (topic, payload) => {
  try {
    const data = JSON.parse(payload);
    await dataModel.insertData(data);
  } catch (error) {
    console.error("Error parsing JSON or inserting data:", error);
  }
});
