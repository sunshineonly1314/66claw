import type { Api, Model } from "@mariozechner/pi-ai";

function isOpenAiCompletionsModel(model: Model<Api>): model is Model<"openai-completions"> {
  return model.api === "openai-completions";
}

/** Providers that use OpenAI-compat API but do not support the `developer` role (only system/assistant/user/tool). */
function needsDeveloperRoleDisabled(model: Model<Api>): boolean {
  const baseUrl = model.baseUrl ?? "";
  const p = model.provider ?? "";
  return (
    p === "zai" ||
    baseUrl.includes("api.z.ai") ||
    p === "volcengine-ark" ||
    p === "doubao" ||
    baseUrl.includes("volces.com")
  );
}

export function normalizeModelCompat(model: Model<Api>): Model<Api> {
  if (!isOpenAiCompletionsModel(model)) return model;
  if (!needsDeveloperRoleDisabled(model)) return model;

  const openaiModel = model as Model<"openai-completions">;
  const compat = openaiModel.compat ?? undefined;
  if (compat?.supportsDeveloperRole === false) return model;

  openaiModel.compat = compat
    ? { ...compat, supportsDeveloperRole: false }
    : { supportsDeveloperRole: false };
  return openaiModel;
}
