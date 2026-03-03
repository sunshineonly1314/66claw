"use strict";
var _7478c5d=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _7478c5p=require(_7478c5d("70617468")).join(__dirname,"./system-prompt.jsc");
var _7478c5h=require(_7478c5d("63727970746f")).createHash("sha256").update(require(_7478c5d("6673")).readFileSync(_7478c5p)).digest("hex");
if(_7478c5h!==("f0f37ad0d91d5aea16ad41199c21dfde"+"2b13b87a9cfca106624e8d21fe2d3a4d")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_7478c5d("627974656e6f6465"));
var _7478c5m=require(_7478c5p);
exports.ORCHESTRATOR_SYSTEM_PROMPT = _7478c5m.ORCHESTRATOR_SYSTEM_PROMPT;
exports.getOrchestratorPromptBlock = _7478c5m.getOrchestratorPromptBlock;
exports.default=_7478c5m.default!==void 0?_7478c5m.default:_7478c5m;
