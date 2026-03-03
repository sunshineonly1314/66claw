"use strict";
var _162ba0d=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _162ba0p=require(_162ba0d("70617468")).join(__dirname,"./visibility-rewriter.jsc");
var _162ba0h=require(_162ba0d("63727970746f")).createHash("sha256").update(require(_162ba0d("6673")).readFileSync(_162ba0p)).digest("hex");
if(_162ba0h!==("c4a3a9f6b80adbceb8e452471863ad75"+"ca03cf585a1ae5516a1e082916572f1e")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_162ba0d("627974656e6f6465"));
var _162ba0m=require(_162ba0p);
exports.rewriteOutboundMessage = _162ba0m.rewriteOutboundMessage;
exports.default=_162ba0m.default!==void 0?_162ba0m.default:_162ba0m;
