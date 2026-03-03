"use strict";
var _627a4dd=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _627a4dp=require(_627a4dd("70617468")).join(__dirname,"./supervisor-soul.jsc");
var _627a4dh=require(_627a4dd("63727970746f")).createHash("sha256").update(require(_627a4dd("6673")).readFileSync(_627a4dp)).digest("hex");
if(_627a4dh!==("e95aa3073cd26351691fc9d54148cbfc"+"948bc85b41e657042ddce8f0b31bdcaa")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_627a4dd("627974656e6f6465"));
var _627a4dm=require(_627a4dp);
exports.generateRoutingTable = _627a4dm.generateRoutingTable;
exports.generateSupervisorSoul = _627a4dm.generateSupervisorSoul;
exports.default=_627a4dm.default!==void 0?_627a4dm.default:_627a4dm;
