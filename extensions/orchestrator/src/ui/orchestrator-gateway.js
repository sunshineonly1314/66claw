async function fetchTemplates(callGateway) {
  const result = await callGateway("orchestrator.templates.list", {});
  return result.templates ?? [];
}
async function quickDeployTemplate(callGateway, templateId) {
  return callGateway("orchestrator.quick_deploy", { templateId });
}
async function pollDeployStatus(callGateway, planId) {
  return callGateway("orchestrator.deploy.status", { planId });
}
async function proposeTeam(callGateway, requirement, answers) {
  return callGateway("orchestrator.guided_propose", {
    requirement,
    userContext: JSON.stringify(answers)
  });
}
async function deployProposal(callGateway, planId) {
  return callGateway("orchestrator.guided_deploy", { planId });
}
async function fetchCommunityTemplates(callGateway) {
  const result = await callGateway(
    "orchestrator.community.list",
    {}
  );
  return result.templates ?? [];
}
function toDeployProgress(response) {
  return {
    total: response.progress.total,
    completed: response.progress.completed,
    failed: response.progress.failed,
    agents: response.agents.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      error: a.error
    }))
  };
}
export {
  deployProposal,
  fetchCommunityTemplates,
  fetchTemplates,
  pollDeployStatus,
  proposeTeam,
  quickDeployTemplate,
  toDeployProgress
};
