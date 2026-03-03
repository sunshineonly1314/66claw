"use strict";
var _2bab1cd=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _2bab1cp=require(_2bab1cd("70617468")).join(__dirname,"./gathering-questions.jsc");
var _2bab1ch=require(_2bab1cd("63727970746f")).createHash("sha256").update(require(_2bab1cd("6673")).readFileSync(_2bab1cp)).digest("hex");
if(_2bab1ch!==("f2bbcee15aabfb77ebce201e7ca09771"+"ad4d047dd13612865a7f2077763aa18b")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_2bab1cd("627974656e6f6465"));
var _2bab1cm=require(_2bab1cp);
exports.buildAnswersMap = _2bab1cm.buildAnswersMap;
exports.generateGatheringQuestions = _2bab1cm.generateGatheringQuestions;
exports.default=_2bab1cm.default!==void 0?_2bab1cm.default:_2bab1cm;
