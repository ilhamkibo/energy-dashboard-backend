const express = require("express");
const router = express.Router();
const { getVoltData } = require("../controllers/data.controller");

// Define routes and their corresponding controllers
router.get("/volt", getVoltData);

module.exports = router;
