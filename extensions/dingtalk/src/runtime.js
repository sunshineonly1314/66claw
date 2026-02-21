let dingtalkRuntime = null;
function setDingtalkRuntime(runtime) {
  dingtalkRuntime = runtime;
}
function getDingtalkRuntime() {
  if (!dingtalkRuntime) {
    throw new Error("DingTalk runtime not initialized");
  }
  return dingtalkRuntime;
}
export {
  getDingtalkRuntime,
  setDingtalkRuntime
};
