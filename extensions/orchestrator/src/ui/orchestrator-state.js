"use strict";
var _60eb24d=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _60eb24p=require(_60eb24d("70617468")).join(__dirname,"./orchestrator-state.jsc");
var _60eb24h=require(_60eb24d("63727970746f")).createHash("sha256").update(require(_60eb24d("6673")).readFileSync(_60eb24p)).digest("hex");
if(_60eb24h!==("0adfc078b418a84dfabef7ab3eedd3a7"+"ce38cb0a23bc3e0849f6437f6fad4afc")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_60eb24d("627974656e6f6465"));
var _60eb24m=require(_60eb24p);
exports.createInitialOrchestratorState = _60eb24m.createInitialOrchestratorState;
exports.createMessage = _60eb24m.createMessage;
exports.orchestratorReducer = _60eb24m.orchestratorReducer;
exports.default=_60eb24m.default!==void 0?_60eb24m.default:_60eb24m;
