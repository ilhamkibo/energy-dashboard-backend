const app = require("./app");
const mqttController = require("./controllers/mqtt.controller");

const PORT = process.env.PORT || 3006;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
