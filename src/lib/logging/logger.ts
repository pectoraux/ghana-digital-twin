// Ghana Digital Twin — Structured Logging Service (Phase 5.21)
// Replaces console.log + tee pattern with structured JSON logging.
//
// Usage:
//   import { logger } from "@/lib/logging/logger";
//   logger.info("pipeline.run", { tilesProcessed: 5, durationMs: 1200 });
//   logger.warn("connector.degraded", { source: "stac-sentinel-2", latency: 5000 });
//   logger.error("pipeline.error", { error: "Band read failed", tileId: "T32" });
//   logger.audit("user.login", { userId: "abc", role: "CITIZEN" });

type LogLevel = "debug" | "info" | "warn" | "error" | "audit";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  data?: Record<string, any>;
  requestId?: string;
  environment: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  audit: 3,
};

const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

class Logger {
  private environment: string;
  private requestId: string | undefined;

  constructor() {
    this.environment = process.env.NODE_ENV || "development";
  }

  setRequestId(id: string) {
    this.requestId = id;
  }

  private log(level: LogLevel, event: string, data?: Record<string, any>) {
    if (LOG_LEVELS[level] < LOG_LEVELS[MIN_LEVEL]) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      data: data ? this.sanitize(data) : undefined,
      requestId: this.requestId,
      environment: this.environment,
    };

    if (this.environment === "production") {
      console.log(JSON.stringify(entry));
    } else {
      const prefix = this.formatPrefix(level);
      const dataStr = data ? ` ${JSON.stringify(data)}` : "";
      console.log(`${prefix} [${event}]${dataStr}`);
    }
  }

  debug(event: string, data?: Record<string, any>) { this.log("debug", event, data); }
  info(event: string, data?: Record<string, any>) { this.log("info", event, data); }
  warn(event: string, data?: Record<string, any>) { this.log("warn", event, data); }
  error(event: string, data?: Record<string, any>) { this.log("error", event, data); }
  audit(event: string, data?: Record<string, any>) { this.log("audit", event, data); }

  private formatPrefix(level: LogLevel): string {
    const colors: Record<LogLevel, string> = {
      debug: "\x1b[90m",
      info: "\x1b[36m",
      warn: "\x1b[33m",
      error: "\x1b[31m",
      audit: "\x1b[35m",
    };
    const reset = "\x1b[0m";
    return `${colors[level]}${level.toUpperCase().padEnd(5)}${reset}`;
  }

  private sanitize(data: Record<string, any>): Record<string, any> {
    const sensitive = ["password", "passwordHash", "token", "secret", "apiKey", "authorization"];
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (sensitive.some((s) => key.toLowerCase().includes(s))) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.sanitize(value);
      } else if (typeof value === "string" && value.length > 500) {
        sanitized[key] = value.slice(0, 500) + "...[truncated]";
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  child(context: Record<string, any>): Logger {
    const childLogger = new Logger();
    childLogger.environment = this.environment;
    childLogger.requestId = this.requestId;
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (level: LogLevel, event: string, data?: Record<string, any>) => {
      originalLog(level, event, { ...context, ...data });
    };
    return childLogger;
  }
}

export const logger = new Logger();
