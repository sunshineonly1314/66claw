const QqbotOpCode = {
  /** 服务端进行消息推送 */
  DISPATCH: 0,
  /** 客户端或服务端发送心跳 */
  HEARTBEAT: 1,
  /** 客户端发送鉴权 */
  IDENTIFY: 2,
  /** 客户端恢复连接 */
  RESUME: 6,
  /** 服务端通知客户端重新连接 */
  RECONNECT: 7,
  /** 当 identify 或 resume 的时候，如果参数有错，服务端会返回该消息 */
  INVALID_SESSION: 9,
  /** 当客户端与网关建立 ws 连接之后，网关下发的第一条消息 */
  HELLO: 10,
  /** 当发送心跳成功之后，就会收到该消息 */
  HEARTBEAT_ACK: 11,
  /** 仅用于 http 回调模式的回包，代表机器人收到了平台推送的数据 */
  HTTP_CALLBACK_ACK: 12
};
const QqbotEventType = {
  /** 频道消息 */
  MESSAGE_CREATE: "MESSAGE_CREATE",
  /** 私信消息 */
  DIRECT_MESSAGE_CREATE: "DIRECT_MESSAGE_CREATE",
  /** 群聊消息 */
  GROUP_AT_MESSAGE_CREATE: "GROUP_AT_MESSAGE_CREATE",
  /** C2C 消息 */
  C2C_MESSAGE_CREATE: "C2C_MESSAGE_CREATE"
};
export {
  QqbotEventType,
  QqbotOpCode
};
