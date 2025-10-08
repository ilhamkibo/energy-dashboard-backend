const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Power Monitoring API",
      version: "1.0.0",
      description: "API documentation for Power Monitoring System",
    },
    servers: [
      {
        url: "http://localhost:3006/api",
      },
    ],
  },
  apis: ["./routes/*.js"], // lokasi router kamu
};

const specs = swaggerJsdoc(options);

module.exports = { swaggerUi, specs };
