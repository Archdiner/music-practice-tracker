import winston from "winston";

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    ...(process.env.NODE_ENV === "production"
      ? [
          new winston.transports.File({ filename: "error.log", level: "error" }),
          new winston.transports.File({ filename: "combined.log" })
        ]
      : [])
  ]
});

export default logger;


