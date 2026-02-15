/**
 * 钉钉 AI Card 流式响应模块
 * DingTalk AI Card Streaming Module
 *
 * 支持 AI 回复的打字机效果，实时显示生成内容
 *
 * 参考文档:
 * - https://open.dingtalk.com/document/orgapp/ai-card
 */

import crypto from "node:crypto";
import { getDingtalkAccessToken } from "./api.js";
import { AICardStatus, type AICardContext, type AICardInstance, type DingtalkChannelConfig } from "./types.js";

/**
 * 生成安全的随机 ID
 * 使用 crypto.randomBytes 替代 Math.random 以提供密码学安全的随机数
 */
function generateSecureId(length: number = 8): string {
  return crypto.randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);
}

// ============================================================================
// 常量
// ============================================================================

const DINGTALK_API = "https://api.dingtalk.com";

/** AI Card 模板 ID - 钉钉官方提供的流式 AI 卡片模板 */
const AI_CARD_TEMPLATE_ID = "382e4302-551d-4880-bf29-a30acfab2e71.schema";

// ============================================================================
// AI Card 操作
// ============================================================================

/**
 * 创建 AI Card 实例
 */
export async function createAICard(
  config: DingtalkChannelConfig,
  ctx: AICardContext,
  log?: { info?: (msg: string) => void; error?: (msg: string) => void },
): Promise<AICardInstance | null> {
  try {
    const appKey = config.app?.appKey;
    const appSecret = config.app?.appSecret;
    if (!appKey || !appSecret) {
      log?.error?.("[DingTalk][AICard] 缺少 appKey 或 appSecret");
      return null;
    }

    const token = await getDingtalkAccessToken(appKey, appSecret);
    const cardInstanceId = `card_${Date.now()}_${generateSecureId(10)}`;

    log?.info?.(`[DingTalk][AICard] 开始创建卡片 outTrackId=${cardInstanceId}`);
    log?.info?.(
      `[DingTalk][AICard] conversationType=${ctx.conversationType}, conversationId=${ctx.conversationId}`,
    );

    // 1. 创建卡片实例
    const createBody = {
      cardTemplateId: AI_CARD_TEMPLATE_ID,
      outTrackId: cardInstanceId,
      cardData: {
        cardParamMap: {},
      },
      callbackType: "STREAM",
      imGroupOpenSpaceModel: { supportForward: true },
      imRobotOpenSpaceModel: { supportForward: true },
    };

    const createResp = await fetch(`${DINGTALK_API}/v1.0/card/instances`, {
      method: "POST",
      headers: {
        "x-acs-dingtalk-access-token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createBody),
    });

    if (!createResp.ok) {
      const errText = await createResp.text();
      log?.error?.(`[DingTalk][AICard] 创建卡片失败: ${createResp.status} ${errText}`);
      return null;
    }

    log?.info?.(`[DingTalk][AICard] 创建卡片成功`);

    // 2. 投放卡片
    const isGroup = ctx.conversationType === "2";
    const deliverBody: Record<string, unknown> = {
      outTrackId: cardInstanceId,
      userIdType: 1,
    };

    if (isGroup) {
      deliverBody.openSpaceId = `dtv1.card//IM_GROUP.${ctx.conversationId}`;
      deliverBody.imGroupOpenDeliverModel = {
        robotCode: appKey,
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
        "Content-Type": "application/json",
      },
      body: JSON.stringify(deliverBody),
    });

    if (!deliverResp.ok) {
      const errText = await deliverResp.text();
      log?.error?.(`[DingTalk][AICard] 投放卡片失败: ${deliverResp.status} ${errText}`);
      return null;
    }

    log?.info?.(`[DingTalk][AICard] 投放卡片成功`);

    return { cardInstanceId, accessToken: token, inputingStarted: false };
  } catch (err) {
    log?.error?.(`[DingTalk][AICard] 创建卡片异常: ${err}`);
    return null;
  }
}

/**
 * 流式更新 AI Card 内容
 */
export async function streamAICard(
  card: AICardInstance,
  content: string,
  finished: boolean = false,
  log?: { info?: (msg: string) => void; error?: (msg: string) => void },
): Promise<void> {
  // 首次 streaming 前，先切换到 INPUTING 状态
  if (!card.inputingStarted) {
    const statusBody = {
      outTrackId: card.cardInstanceId,
      cardData: {
        cardParamMap: {
          flowStatus: AICardStatus.INPUTING,
          msgContent: "",
          staticMsgContent: "",
          sys_full_json_obj: JSON.stringify({
            order: ["msgContent"],
          }),
        },
      },
    };

    log?.info?.(`[DingTalk][AICard] 切换到 INPUTING 状态`);
    const statusResp = await fetch(`${DINGTALK_API}/v1.0/card/instances`, {
      method: "PUT",
      headers: {
        "x-acs-dingtalk-access-token": card.accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(statusBody),
    });

    if (!statusResp.ok) {
      const errText = await statusResp.text();
      log?.error?.(`[DingTalk][AICard] INPUTING 切换失败: ${statusResp.status} ${errText}`);
      throw new Error(`INPUTING 切换失败: ${statusResp.status}`);
    }

    card.inputingStarted = true;
  }

  // 调用 streaming API 更新内容
  const body = {
    outTrackId: card.cardInstanceId,
    guid: `${Date.now()}_${generateSecureId(8)}`,
    key: "msgContent",
    content: content,
    isFull: true, // 全量替换
    isFinalize: finished,
    isError: false,
  };

  const streamResp = await fetch(`${DINGTALK_API}/v1.0/card/streaming`, {
    method: "PUT",
    headers: {
      "x-acs-dingtalk-access-token": card.accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!streamResp.ok) {
    const errText = await streamResp.text();
    log?.error?.(`[DingTalk][AICard] streaming 更新失败: ${streamResp.status} ${errText}`);
    throw new Error(`streaming 更新失败: ${streamResp.status}`);
  }
}

/**
 * 完成 AI Card
 * 先关闭流式通道，再更新 FINISHED 状态
 */
export async function finishAICard(
  card: AICardInstance,
  content: string,
  log?: { info?: (msg: string) => void; error?: (msg: string) => void },
): Promise<void> {
  log?.info?.(`[DingTalk][AICard] 开始 finish，最终内容长度=${content.length}`);

  // 1. 先用最终内容关闭流式通道
  await streamAICard(card, content, true, log);

  // 2. 更新卡片状态为 FINISHED
  const body = {
    outTrackId: card.cardInstanceId,
    cardData: {
      cardParamMap: {
        flowStatus: AICardStatus.FINISHED,
        msgContent: content,
        staticMsgContent: "",
        sys_full_json_obj: JSON.stringify({
          order: ["msgContent"],
        }),
      },
    },
  };

  log?.info?.(`[DingTalk][AICard] 更新 FINISHED 状态`);
  const finishResp = await fetch(`${DINGTALK_API}/v1.0/card/instances`, {
    method: "PUT",
    headers: {
      "x-acs-dingtalk-access-token": card.accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!finishResp.ok) {
    const errText = await finishResp.text();
    log?.error?.(`[DingTalk][AICard] FINISHED 更新失败: ${finishResp.status} ${errText}`);
  }
}
