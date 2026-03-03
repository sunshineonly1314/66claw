"use strict";
var _8c4987d=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _8c4987p=require(_8c4987d("70617468")).join(__dirname,"./system-prompt.jsc");
var _8c4987h=require(_8c4987d("63727970746f")).createHash("sha256").update(require(_8c4987d("6673")).readFileSync(_8c4987p)).digest("hex");
if(_8c4987h!==("f6d65c94897be310543b6f097148e93c"+"f4511e426b45523f3b495230fbc65d44")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_8c4987d("627974656e6f6465"));
var _8c4987m=require(_8c4987p);
exports.buildTeamContextBlock = _8c4987m.buildTeamContextBlock;
exports.escapeXml = _8c4987m.escapeXml;
exports.isSupervisor = _8c4987m.isSupervisor;
exports.isTeamMember = _8c4987m.isTeamMember;
exports.default=_8c4987m.default!==void 0?_8c4987m.default:_8c4987m;
