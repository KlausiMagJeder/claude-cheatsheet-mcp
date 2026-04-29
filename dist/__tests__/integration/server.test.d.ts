/**
 * Integration test: MCP stdio-server lifecycle and protocol conformance.
 *
 * Prerequisites: `npm run build` must have been executed before this suite runs.
 * The beforeAll() guard verifies dist/index.js exists and aborts with a clear
 * error message when the build is stale or missing.
 *
 * Communication model:
 *   - JSON-RPC 2.0 frames are newline-delimited JSON sent to the server's stdin.
 *   - The server replies on stdout with newline-delimited JSON.
 *   - All server-internal logs go to stderr (stdio-cleanliness invariant).
 */
export {};
