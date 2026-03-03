"use strict";
var _076da6d=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _076da6p=require(_076da6d("70617468")).join(__dirname,"./memory-share-tool.jsc");
var _076da6h=require(_076da6d("63727970746f")).createHash("sha256").update(require(_076da6d("6673")).readFileSync(_076da6p)).digest("hex");
if(_076da6h!==("1980379373b79fb841a65297129437fa"+"a4914fcba9a06ea66e4c67e1c3058841")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_076da6d("627974656e6f6465"));
var _076da6m=require(_076da6p);
exports.createMemoryShareTool = _076da6m.createMemoryShareTool;
exports.default=_076da6m.default!==void 0?_076da6m.default:_076da6m;
