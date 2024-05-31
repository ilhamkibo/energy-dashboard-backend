const express = require("express");
const { corsMiddleware } = require("./middleware/cors.middleware");
const dataRoutes = require("./routes/data.routes");

const app = express();

app.use(corsMiddleware);
app.use(express.json());

app.use("/api", dataRoutes);

module.exports = app;
