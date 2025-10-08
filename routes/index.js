const express = require("express");
const router = express.Router();

const voltRoutes = require("./volt.routes");
const currentRoutes = require("./current.routes");
const wattRoutes = require("./watt.routes");
const temperatureRoutes = require("./temperature.routes");
const kvaRoutes = require("./kva.routes");
const historyRoutes = require("./history.routes");

router.use(voltRoutes);
router.use(currentRoutes);
router.use(wattRoutes);
router.use(temperatureRoutes);
router.use(kvaRoutes);
router.use(historyRoutes);

module.exports = router;
