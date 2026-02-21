let feishuRuntime = null;
function setFeishuRuntime(runtime) {
  feishuRuntime = runtime;
}
function getFeishuRuntime() {
  if (!feishuRuntime) {
    throw new Error("Feishu runtime not initialized");
  }
  return feishuRuntime;
}
export {
  getFeishuRuntime,
  setFeishuRuntime
};
