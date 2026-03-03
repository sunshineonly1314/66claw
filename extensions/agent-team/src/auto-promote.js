"use strict";
var _8af893d=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _8af893p=require(_8af893d("70617468")).join(__dirname,"./auto-promote.jsc");
var _8af893h=require(_8af893d("63727970746f")).createHash("sha256").update(require(_8af893d("6673")).readFileSync(_8af893p)).digest("hex");
if(_8af893h!==("aa62cd9ebb200ac165fa8b4ed6731f8a"+"54cfaf69345d442fd60b25a8aefb99a2")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_8af893d("627974656e6f6465"));
var _8af893m=require(_8af893p);
exports.autoPromoteEntries = _8af893m.autoPromoteEntries;
exports.default=_8af893m.default!==void 0?_8af893m.default:_8af893m;
