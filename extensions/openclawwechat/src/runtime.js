let wechatRuntime = null;
function setWechatMiniprogramRuntime(runtime) {
  wechatRuntime = runtime;
}
function getWechatMiniprogramRuntime() {
  if (!wechatRuntime) {
    throw new Error("WeChat MiniProgram runtime not initialized");
  }
  return wechatRuntime;
}
export {
  getWechatMiniprogramRuntime,
  setWechatMiniprogramRuntime
};
