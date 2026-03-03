"use strict";
var _cc4cffd=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _cc4cffp=require(_cc4cffd("70617468")).join(__dirname,"./orchestrate-tool.jsc");
var _cc4cffh=require(_cc4cffd("63727970746f")).createHash("sha256").update(require(_cc4cffd("6673")).readFileSync(_cc4cffp)).digest("hex");
if(_cc4cffh!==("0f337802fcf979ba20c99f09bd358db4"+"da6d3879f7cc11d478e5707d300d21ad")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_cc4cffd("627974656e6f6465"));
var _cc4cffm=require(_cc4cffp);
exports.createOrchestrateTool = _cc4cffm.createOrchestrateTool;
exports.deepCloneBlueprints = _cc4cffm.deepCloneBlueprints;
exports.deployAgentId = _cc4cffm.deployAgentId;
exports.isDeployActive = _cc4cffm.isDeployActive;
exports.listOrchestratedAgents = _cc4cffm.listOrchestratedAgents;
exports.listOrchestratedAgentsForPlan = _cc4cffm.listOrchestratedAgentsForPlan;
exports.performGuidedDeploy = _cc4cffm.performGuidedDeploy;
exports.performGuidedPropose = _cc4cffm.performGuidedPropose;
exports.performQuickDeploy = _cc4cffm.performQuickDeploy;
exports.validatePlanForDeploy = _cc4cffm.validatePlanForDeploy;
exports.default=_cc4cffm.default!==void 0?_cc4cffm.default:_cc4cffm;
