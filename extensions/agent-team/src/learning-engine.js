"use strict";
var _71de65d=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _71de65p=require(_71de65d("70617468")).join(__dirname,"./learning-engine.jsc");
var _71de65h=require(_71de65d("63727970746f")).createHash("sha256").update(require(_71de65d("6673")).readFileSync(_71de65p)).digest("hex");
if(_71de65h!==("5882b553f66d4287db70d340c6a1bf30"+"535c441e60113ee8191e56a4d9c3f278")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_71de65d("627974656e6f6465"));
var _71de65m=require(_71de65p);
exports.LEARNING_CYCLE_THRESHOLD = _71de65m.LEARNING_CYCLE_THRESHOLD;
exports.analyzeLearningOpportunities = _71de65m.analyzeLearningOpportunities;
exports.applyAutoOptimizations = _71de65m.applyAutoOptimizations;
exports.formatLearningReport = _71de65m.formatLearningReport;
exports.generateLearningHints = _71de65m.generateLearningHints;
exports.shouldTriggerLearning = _71de65m.shouldTriggerLearning;
exports.default=_71de65m.default!==void 0?_71de65m.default:_71de65m;
