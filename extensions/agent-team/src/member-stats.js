"use strict";
var _074857d=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _074857p=require(_074857d("70617468")).join(__dirname,"./member-stats.jsc");
var _074857h=require(_074857d("63727970746f")).createHash("sha256").update(require(_074857d("6673")).readFileSync(_074857p)).digest("hex");
if(_074857h!==("6755f250953a5e7920433087cb17d225"+"0d79951507e88840accdba32f5ac5fe7")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_074857d("627974656e6f6465"));
var _074857m=require(_074857p);
exports.computeAverageDuration = _074857m.computeAverageDuration;
exports.createInitialMemberStats = _074857m.createInitialMemberStats;
exports.recordMemberCall = _074857m.recordMemberCall;
exports.default=_074857m.default!==void 0?_074857m.default:_074857m;
