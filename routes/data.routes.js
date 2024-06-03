const express = require("express");
const router = express.Router();
const {
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
} = require("../controllers/data.controller");

// Define routes and their corresponding controllers
router.get("/volt", getVoltData);
router.get("/current", getCurrentData);
router.get("/watt", getWattData);
router.get("/kva", getKvaData);
router.get("/frequency", getFrequencyData);
router.get("/temp", getTemperatureData);
router.get("/kw_hour", getDailyWattCostData);
router.get("/kw_day", getMonthlyWattCostData);
router.get("/kw_month", getYearlyWattCostData);
router.get("/kw_custom", getCustomWattCostData);
router.get("/dashboard", getDashboardData);

module.exports = router;
