const app = require("./app");
const mqttController = require("./controllers/mqtt.controller");

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
