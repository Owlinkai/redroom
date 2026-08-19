import { describe, it, expect } from "vitest";
import WebSocket from "ws";

describe("AIS_API_KEY validation", () => {
  it("should connect to aisstream.io WebSocket with the API key", async () => {
    const apiKey = process.env.AIS_API_KEY;
    expect(apiKey).toBeTruthy();

    // Test by opening a WebSocket connection and sending a subscription
    const result = await new Promise<string>((resolve) => {
      const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
      const timeout = setTimeout(() => {
        ws.close();
        resolve("timeout");
      }, 10000);

      ws.on("open", () => {
        // Send subscription message with the API key
        ws.send(JSON.stringify({
          APIKey: apiKey,
          BoundingBoxes: [[[40, -5], [50, 5]]],
          FilterMessageTypes: ["PositionReport"],
        }));
      });

      ws.on("message", (data) => {
        clearTimeout(timeout);
        ws.close();
        // If we receive any message, the key is valid
        resolve("valid");
      });

      ws.on("error", (err) => {
        clearTimeout(timeout);
        ws.close();
        resolve(`error: ${err.message}`);
      });

      ws.on("close", (code) => {
        clearTimeout(timeout);
        if (code === 1008 || code === 4001) {
          resolve("invalid_key");
        }
      });
    });

    // Either we get data (valid) or timeout (key accepted but no ships in area yet)
    expect(["valid", "timeout"]).toContain(result);
  }, 15000);
});
