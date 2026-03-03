"use strict";
var _de3581d=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _de3581p=require(_de3581d("70617468")).join(__dirname,"./capability-inference.jsc");
var _de3581h=require(_de3581d("63727970746f")).createHash("sha256").update(require(_de3581d("6673")).readFileSync(_de3581p)).digest("hex");
if(_de3581h!==("b1f5d3c00b09e85e437e46ce386e17ef"+"8a099b35925c5c9f7ec1bfb06fe94a6b")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_de3581d("627974656e6f6465"));
var _de3581m=require(_de3581p);
exports.estimateRoleComplexity = _de3581m.estimateRoleComplexity;
exports.inferAgentCapabilities = _de3581m.inferAgentCapabilities;
exports.isSupervisorRole = _de3581m.isSupervisorRole;
exports.default=_de3581m.default!==void 0?_de3581m.default:_de3581m;
