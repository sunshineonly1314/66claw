"use strict";
var _b5e838d=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _b5e838p=require(_b5e838d("70617468")).join(__dirname,"./cost-estimator.jsc");
var _b5e838h=require(_b5e838d("63727970746f")).createHash("sha256").update(require(_b5e838d("6673")).readFileSync(_b5e838p)).digest("hex");
if(_b5e838h!==("7f1aa417966762ec42536985bb820d3e"+"394446557a5d1d852cea01f5a0d25b30")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_b5e838d("627974656e6f6465"));
var _b5e838m=require(_b5e838p);
exports.estimateAgentDailyCost = _b5e838m.estimateAgentDailyCost;
exports.estimateTeamDailyCost = _b5e838m.estimateTeamDailyCost;
exports.formatCostRange = _b5e838m.formatCostRange;
exports.default=_b5e838m.default!==void 0?_b5e838m.default:_b5e838m;
