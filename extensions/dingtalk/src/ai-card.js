import crypto from "node:crypto";
import { getDingtalkAccessToken } from "./api.js";
import { AICardStatus } from "./types.js";
function generateSecureId(length = 8) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);
}
const DINGTALK_API = "https://api.dingtalk.com";
const AI_CARD_TEMPLATE_ID = "382e4302-551d-4880-bf29-a30acfab2e71.schema";
const AI_CARD_TIMEOUT_MS = 15e3;
async function createAICard(config, ctx, log) {
  try {
    const appKey = config.app?.appKey;
    const appSecret = config.app?.appSecret;
    if (!appKey || !appSecret) {
      log?.error?.("[DingTalk][AICard] \u7F3A\u5C11 appKey \u6216 appSecret");
      return null;
    }
    const token = await getDingtalkAccessToken(appKey, appSecret);
    const cardInstanceId = `card_${Date.now()}_${generateSecureId(10)}`;
    log?.info?.(`[DingTalk][AICard] \u5F00\u59CB\u521B\u5EFA\u5361\u7247 outTrackId=${cardInstanceId}`);
    log?.info?.(
      `[DingTalk][AICard] conversationType=${ctx.conversationType}, conversationId=${ctx.conversationId}`
    );
    const createBody = {
      cardTemplateId: AI_CARD_TEMPLATE_ID,
      outTrackId: cardInstanceId,
      cardData: {
        cardParamMap: {}
      },
      callbackType: "STREAM",
      imGroupOpenSpaceModel: { supportForward: true },
      imRobotOpenSpaceModel: { supportForward: true }
    };
    const createResp = await fetch(`${DINGTALK_API}/v1.0/card/instances`, {
      method: "POST",
      headers: {
        "x-acs-dingtalk-access-token": token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(createBody),
      signal: AbortSignal.timeout(AI_CARD_TIMEOUT_MS)
    });
    if (!createResp.ok) {
      const errText = await createResp.text();
      log?.error?.(`[DingTalk][AICard] \u521B\u5EFA\u5361\u7247\u5931\u8D25: ${createResp.status} ${errText}`);
      return null;
    }
    log?.info?.(`[DingTalk][AICard] \u521B\u5EFA\u5361\u7247\u6210\u529F`);
    const isGroup = ctx.conversationType === "2";
    const deliverBody = {
      outTrackId: cardInstanceId,
      userIdType: 1
    };
    if (isGroup) {
      deliverBody.openSpaceId = `dtv1.card//IM_GROUP.${ctx.conversationId}`;
      deliverBody.imGroupOpenDeliverModel = {
        robotCode: appKey
      };
    } else {
      const userId = ctx.senderStaffId || ctx.senderId;
      deliverBody.openSpaceId = `dtv1.card//IM_ROBOT.${userId}`;
      deliverBody.imRobotOpenDeliverModel = { spaceType: "IM_ROBOT" };
    }
    const deliverResp = await fetch(`${DINGTALK_API}/v1.0/card/instances/deliver`, {
      method: "POST",
      headers: {
        "x-acs-dingtalk-access-token": token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(deliverBody),
      signal: AbortSignal.timeout(AI_CARD_TIMEOUT_MS)
    });
    if (!deliverResp.ok) {
      const errText = await deliverResp.text();
      log?.error?.(`[DingTalk][AICard] \u6295\u653E\u5361\u7247\u5931\u8D25: ${deliverResp.status} ${errText}`);
      return null;
    }
    log?.info?.(`[DingTalk][AICard] \u6295\u653E\u5361\u7247\u6210\u529F`);
    return { cardInstanceId, accessToken: token, inputingStarted: false };
  } catch (err) {
    log?.error?.(`[DingTalk][AICard] \u521B\u5EFA\u5361\u7247\u5F02\u5E38: ${err}`);
    return null;
  }
}
async function streamAICard(card, content, finished = false, log) {
  if (!card.inputingStarted) {
    const statusBody = {
      outTrackId: card.cardInstanceId,
      cardData: {
        cardParamMap: {
          flowStatus: AICardStatus.INPUTING,
          msgContent: "",
          staticMsgContent: "",
          sys_full_json_obj: JSON.stringify({
            order: ["msgContent"]
          })
        }
      }
    };
    log?.info?.(`[DingTalk][AICard] \u5207\u6362\u5230 INPUTING \u72B6\u6001`);
    const statusResp = await fetch(`${DINGTALK_API}/v1.0/card/instances`, {
      method: "PUT",
      headers: {
        "x-acs-dingtalk-access-token": card.accessToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(statusBody),
      signal: AbortSignal.timeout(AI_CARD_TIMEOUT_MS)
    });
    if (!statusResp.ok) {
      const errText = await statusResp.text();
      log?.error?.(`[DingTalk][AICard] INPUTING \u5207\u6362\u5931\u8D25: ${statusResp.status} ${errText}`);
      throw new Error(`INPUTING \u5207\u6362\u5931\u8D25: ${statusResp.status}`);
    }
    card.inputingStarted = true;
  }
  const body = {
    outTrackId: card.cardInstanceId,
    guid: `${Date.now()}_${generateSecureId(8)}`,
    key: "msgContent",
    content,
    isFull: true,
    // 全量替换
    isFinalize: finished,
    isError: false
  };
  const streamResp = await fetch(`${DINGTALK_API}/v1.0/card/streaming`, {
    method: "PUT",
    headers: {
      "x-acs-dingtalk-access-token": card.accessToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(AI_CARD_TIMEOUT_MS)
  });
  if (!streamResp.ok) {
    const errText = await streamResp.text();
    log?.error?.(`[DingTalk][AICard] streaming \u66F4\u65B0\u5931\u8D25: ${streamResp.status} ${errText}`);
    throw new Error(`streaming \u66F4\u65B0\u5931\u8D25: ${streamResp.status}`);
  }
}
async function finishAICard(card, content, log) {
  log?.info?.(`[DingTalk][AICard] \u5F00\u59CB finish\uFF0C\u6700\u7EC8\u5185\u5BB9\u957F\u5EA6=${content.length}`);
  await streamAICard(card, content, true, log);
  const body = {
    outTrackId: card.cardInstanceId,
    cardData: {
      cardParamMap: {
        flowStatus: AICardStatus.FINISHED,
        msgContent: content,
        staticMsgContent: "",
        sys_full_json_obj: JSON.stringify({
          order: ["msgContent"]
        })
      }
    }
  };
  log?.info?.(`[DingTalk][AICard] \u66F4\u65B0 FINISHED \u72B6\u6001`);
  const finishResp = await fetch(`${DINGTALK_API}/v1.0/card/instances`, {
    method: "PUT",
    headers: {
      "x-acs-dingtalk-access-token": card.accessToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(AI_CARD_TIMEOUT_MS)
  });
  if (!finishResp.ok) {
    const errText = await finishResp.text();
    log?.error?.(`[DingTalk][AICard] FINISHED \u66F4\u65B0\u5931\u8D25: ${finishResp.status} ${errText}`);
  }
}
export {
  createAICard,
  finishAICard,
  streamAICard
};
