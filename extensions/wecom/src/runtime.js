let wecomRuntime = null;
function setWecomRuntime(runtime) {
  wecomRuntime = runtime;
}
function getWecomRuntime() {
  if (!wecomRuntime) {
    throw new Error("WeCom runtime not initialized");
  }
  return wecomRuntime;
}
export {
  getWecomRuntime,
  setWecomRuntime
};
