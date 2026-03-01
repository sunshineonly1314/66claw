function rewriteOutboundMessage(params) {
  const { content, project, agentId } = params;
  if (!content) return { content };
  const mode = project.visibility.mode;
  switch (mode) {
    case "unified":
      return { content };
    case "transparent": {
      const member = project.members.find((m) => m.id === agentId);
      const name = member?.name ?? agentId;
      return { content: `[@${name}] ${content}` };
    }
    case "team":
    default: {
      const displayName = project.visibility.displayName;
      if (displayName) {
        return { content: `[${displayName}] ${content}` };
      }
      return { content };
    }
  }
}
export {
  rewriteOutboundMessage
};
