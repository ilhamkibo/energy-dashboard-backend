const express = require("express");
const { corsMiddleware } = require("./middleware/cors.middleware");
const dataRoutes = require("./routes/index");
const { swaggerUi, specs } = require("./swagger");

const app = express();

app.use(corsMiddleware);
app.use(express.json());

// ✅ Swagger route
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

app.use("/api", dataRoutes);

module.exports = app;
