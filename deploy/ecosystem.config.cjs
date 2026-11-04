// pm2 process definition for the API on the server. Settings come from the .env file next to package.json.
const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "fg-backend",
      cwd: path.resolve(__dirname, ".."),
      script: "dist/index.js",
      env: { NODE_ENV: "production" },
      max_memory_restart: "512M",
    },
  ],
};
