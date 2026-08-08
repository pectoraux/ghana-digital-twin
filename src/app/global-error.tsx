"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error.message, error.digest);
  }, [error]);

  return (
    <html>
      <body style={{ margin: 0, padding: 0, background: "#0a0a0a", color: "#fafafa", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ maxWidth: "400px", textAlign: "center" }}>
            <h2 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "8px" }}>
              Application Error
            </h2>
            <p style={{ fontSize: "15px", color: "#a1a1aa", marginBottom: "16px" }}>
              A critical error occurred. Please refresh the page.
            </p>
            {error.digest && (
              <p style={{ fontSize: "12px", fontFamily: "monospace", color: "#52525b", marginBottom: "16px" }}>
                Error ID: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{
                padding: "8px 24px",
                borderRadius: "8px",
                border: "1px solid #333",
                background: "#1a1a1a",
                color: "#fafafa",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
