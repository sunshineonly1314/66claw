"use strict";
var _ce5feed=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _ce5feep=require(_ce5feed("70617468")).join(__dirname,"./state.jsc");
var _ce5feeh=require(_ce5feed("63727970746f")).createHash("sha256").update(require(_ce5feed("6673")).readFileSync(_ce5feep)).digest("hex");
if(_ce5feeh!==("5f5a546374ed6f2d8cb707f73a9b3fe5"+"80b8b0ef10c61f692db170a720a0cdad")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_ce5feed("627974656e6f6465"));
var _ce5feem=require(_ce5feep);
exports.createInitialState = _ce5feem.createInitialState;
exports.generatePlanId = _ce5feem.generatePlanId;
exports.initStateDir = _ce5feem.initStateDir;
exports.listPlanIds = _ce5feem.listPlanIds;
exports.loadPlan = _ce5feem.loadPlan;
exports.loadReport = _ce5feem.loadReport;
exports.loadState = _ce5feem.loadState;
exports.savePlan = _ce5feem.savePlan;
exports.saveReport = _ce5feem.saveReport;
exports.saveState = _ce5feem.saveState;
exports.updateAgentStatus = _ce5feem.updateAgentStatus;
exports.default=_ce5feem.default!==void 0?_ce5feem.default:_ce5feem;
