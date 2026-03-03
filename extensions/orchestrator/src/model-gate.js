"use strict";
var _4051e7d=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _4051e7p=require(_4051e7d("70617468")).join(__dirname,"./model-gate.jsc");
var _4051e7h=require(_4051e7d("63727970746f")).createHash("sha256").update(require(_4051e7d("6673")).readFileSync(_4051e7p)).digest("hex");
if(_4051e7h!==("b05aa11611144ed3b8623bec9c78d78f"+"090ee540fa38b5000d9fb1d800163bac")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_4051e7d("627974656e6f6465"));
var _4051e7m=require(_4051e7p);
exports.checkModelEligibility = _4051e7m.checkModelEligibility;
exports.default=_4051e7m.default!==void 0?_4051e7m.default:_4051e7m;
