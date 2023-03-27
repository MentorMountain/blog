import "dotenv/config";

const DEFAULT = "";

const ENV = {
  JWT_SECRET: process.env.JWT_SECRET || "secret",
  GATEWAY_DOMAIN: process.env.GATEWAY_DOMAIN || "http://localhost",
  WEBAPP_DOMAIN: process.env.WEBAPP_DOMAIN || "http://localhost",
  PROJECT_ID: process.env.PROJECT_ID || DEFAULT,
  DB_COLLECTION_NAME: process.env.DB_COLLECTION_NAME || DEFAULT
};

for (const [k, v] of Object.entries(ENV)) {
  if (v === DEFAULT) {
    console.error(`${k} UNAVAILABLE`);
    process.exit(1);
  }
}

export default ENV;
