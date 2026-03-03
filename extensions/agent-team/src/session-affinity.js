"use strict";
var _760dd9d=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _760dd9p=require(_760dd9d("70617468")).join(__dirname,"./session-affinity.jsc");
var _760dd9h=require(_760dd9d("63727970746f")).createHash("sha256").update(require(_760dd9d("6673")).readFileSync(_760dd9p)).digest("hex");
if(_760dd9h!==("25fdd75777b68ebe5757bd31760c75ad"+"7ded02e1a95528a075629ce33884ced2")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_760dd9d("627974656e6f6465"));
var _760dd9m=require(_760dd9p);
exports.clearAffinity = _760dd9m.clearAffinity;
exports.clearProjectAffinities = _760dd9m.clearProjectAffinities;
exports.getAffinity = _760dd9m.getAffinity;
exports.getAllAffinities = _760dd9m.getAllAffinities;
exports.isAffinityExpired = _760dd9m.isAffinityExpired;
exports.purgeExpiredAffinities = _760dd9m.purgeExpiredAffinities;
exports.resetAllAffinities = _760dd9m.resetAllAffinities;
exports.resolveAffinityAgent = _760dd9m.resolveAffinityAgent;
exports.setAffinity = _760dd9m.setAffinity;
exports.default=_760dd9m.default!==void 0?_760dd9m.default:_760dd9m;
