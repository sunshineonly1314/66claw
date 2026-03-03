"use strict";
var _7cfb98d=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _7cfb98p=require(_7cfb98d("70617468")).join(__dirname,"./task-coordinator.jsc");
var _7cfb98h=require(_7cfb98d("63727970746f")).createHash("sha256").update(require(_7cfb98d("6673")).readFileSync(_7cfb98p)).digest("hex");
if(_7cfb98h!==("604908461a4fd411166f6c479b7c8b54"+"7a4d2fbf8ff25136564d47f6455dcf00")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_7cfb98d("627974656e6f6465"));
var _7cfb98m=require(_7cfb98p);
exports.generateWorkflowInstructions = _7cfb98m.generateWorkflowInstructions;
exports.matchWorkflow = _7cfb98m.matchWorkflow;
exports.default=_7cfb98m.default!==void 0?_7cfb98m.default:_7cfb98m;
