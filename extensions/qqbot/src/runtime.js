let qqbotRuntime = null;
function setQqbotRuntime(runtime) {
  qqbotRuntime = runtime;
}
function getQqbotRuntime() {
  if (!qqbotRuntime) {
    throw new Error("QQ Bot runtime not initialized");
  }
  return qqbotRuntime;
}
export {
  getQqbotRuntime,
  setQqbotRuntime
};
