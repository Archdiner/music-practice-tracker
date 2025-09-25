// Prefer winston; fall back to console-based JSON logger if unavailable
let logger: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const winston = require("winston");
  logger = winston.createLogger({
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
} catch {
  const base = (level: string) => (message: string, meta?: Record<string, unknown>) => {
    const payload: Record<string, unknown> = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(meta || {})
    };
    if (level === "error") console.error(JSON.stringify(payload));
    else if (level === "warn") console.warn(JSON.stringify(payload));
    else console.log(JSON.stringify(payload));
  };
  logger = {
    error: base("error"),
    warn: base("warn"),
    info: base("info"),
    debug: base("debug"),
    child(defaultMeta: Record<string, unknown>) {
      const wrap = (lvl: string) => (msg: string, meta?: Record<string, unknown>) =>
        (this as any)[lvl](msg, { ...(defaultMeta || {}), ...(meta || {}) });
      return {
        error: wrap("error"),
        warn: wrap("warn"),
        info: wrap("info"),
        debug: wrap("debug")
      };
    }
  };
}

export default logger;


