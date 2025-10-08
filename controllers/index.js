const { getVoltData } = require("./volt.controller");
const { getCurrentData } = require("./current.controller");
const { getWattData } = require("./watt.controller");
const { getKvaData } = require("./kva.controller");
const { getFrequencyData } = require("./frequency.controller");
const { getTemperatureData } = require("./temperature.controller");
const { getHistoryData } = require("./history.controller");

module.exports = {
  getVoltData,
  getCurrentData,
  getWattData,
  getKvaData,
  getFrequencyData,
  getTemperatureData,
  getHistoryData,
};
