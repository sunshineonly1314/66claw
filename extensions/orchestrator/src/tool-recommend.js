"use strict";
var _9e5818d=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _9e5818p=require(_9e5818d("70617468")).join(__dirname,"./tool-recommend.jsc");
var _9e5818h=require(_9e5818d("63727970746f")).createHash("sha256").update(require(_9e5818d("6673")).readFileSync(_9e5818p)).digest("hex");
if(_9e5818h!==("aa2b0c510ad5023dcb23e82a60d8035f"+"3aa0bd6f7efe84a922d340e2bdfff008")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_9e5818d("627974656e6f6465"));
var _9e5818m=require(_9e5818p);
exports.estimateToolTokens = _9e5818m.estimateToolTokens;
exports.mergeToolRecommendations = _9e5818m.mergeToolRecommendations;
exports.recommendToolsForRole = _9e5818m.recommendToolsForRole;
exports.default=_9e5818m.default!==void 0?_9e5818m.default:_9e5818m;
