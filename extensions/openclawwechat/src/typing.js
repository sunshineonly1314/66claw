import { BRIDGE_URL } from "./constants.js";
async function notifyTyping(apiKey, status, log) {
  const encodedAPIKey = apiKey.replace(/:/g, "%3A");
  const url = `${BRIDGE_URL}/bot${encodedAPIKey}/typing`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    if (!response.ok) {
      log?.error?.(
        `typing notify failed: ${response.status} ${response.statusText}`
      );
    }
  } catch (err) {
    log?.error?.(`typing notify failed: ${err}`);
  }
}
export {
  notifyTyping
};
