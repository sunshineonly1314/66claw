"use strict";
var _3a09e0d=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _3a09e0p=require(_3a09e0d("70617468")).join(__dirname,"./soul-optimizer.jsc");
var _3a09e0h=require(_3a09e0d("63727970746f")).createHash("sha256").update(require(_3a09e0d("6673")).readFileSync(_3a09e0p)).digest("hex");
if(_3a09e0h!==("5e706453b7efc828b17c3945f45859a7"+"b3b77525a1410c1f743141f97356972f")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_3a09e0d("627974656e6f6465"));
var _3a09e0m=require(_3a09e0p);
exports.appendLearningHintsToSoul = _3a09e0m.appendLearningHintsToSoul;
exports.buildMemberPerformanceProfile = _3a09e0m.buildMemberPerformanceProfile;
exports.buildSupervisorLearningContext = _3a09e0m.buildSupervisorLearningContext;
exports.removeLearningHintsFromSoul = _3a09e0m.removeLearningHintsFromSoul;
exports.default=_3a09e0m.default!==void 0?_3a09e0m.default:_3a09e0m;
