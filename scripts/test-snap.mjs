#!/usr/bin/env node

const baseUrl = process.argv[2] || process.env.SNAP_BASE_URL || "http://localhost:3000";
const snapUrl = new URL("/snap", baseUrl).toString();

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`✓ ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

async function fetchSnap(path, init = {}) {
  const url = new URL(path, baseUrl).toString();
  return fetch(url, init);
}

async function main() {
  console.log(`Testing snap endpoint: ${snapUrl}`);

  const snapResponse = await fetchSnap("/snap", {
    headers: { Accept: "application/vnd.farcaster.snap+json" },
  });

  assert(snapResponse.ok, `snap GET failed with status ${snapResponse.status}`);
  const snapContentType = snapResponse.headers.get("content-type") || "";
  assert(snapContentType.includes("application/vnd.farcaster.snap+json"), `snap GET returned unexpected content-type: ${snapContentType}`);

  const snapJson = await snapResponse.json();
  assert(snapJson.version === "2.0", `snap JSON version expected 2.0, received ${snapJson.version}`);
  assert(snapJson.ui && typeof snapJson.ui === "object", "snap JSON missing ui object");
  assert(typeof snapJson.ui.root === "string", "snap JSON missing ui.root");
  assert(snapJson.ui.elements && typeof snapJson.ui.elements === "object", "snap JSON missing ui.elements");
  pass("snap GET returns valid snap JSON payload");

  const fallbackResponse = await fetchSnap("/snap");
  assert(fallbackResponse.ok, `fallback GET failed with status ${fallbackResponse.status}`);
  const fallbackType = fallbackResponse.headers.get("content-type") || "";
  assert(fallbackType.includes("text/html"), `fallback GET expected text/html, received ${fallbackType}`);
  const linkHeader = fallbackResponse.headers.get("link") || "";
  assert(linkHeader.includes('rel="alternate"') && linkHeader.includes("application/vnd.farcaster.snap+json"), `fallback GET missing expected Link header, received: ${linkHeader || "<none>"}`);
  pass("fallback GET returns HTML + snap alternate link");

  const postPickResponse = await fetchSnap("/snap?action=pick&option=0", {
    method: "POST",
    headers: { Accept: "application/vnd.farcaster.snap+json" },
  });
  assert(postPickResponse.ok, `snap POST pick failed with status ${postPickResponse.status}`);
  const postType = postPickResponse.headers.get("content-type") || "";
  assert(postType.includes("application/vnd.farcaster.snap+json"), `snap POST returned unexpected content-type: ${postType}`);
  const postJson = await postPickResponse.json();
  assert(postJson.version === "2.0", `snap POST JSON version expected 2.0, received ${postJson.version}`);
  pass("snap POST pick returns valid snap JSON payload");

  console.log("\nAll snap endpoint checks passed.");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
