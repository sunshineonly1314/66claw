"use strict";
var _bd3990d=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _bd3990p=require(_bd3990d("70617468")).join(__dirname,"./index.jsc");
var _bd3990h=require(_bd3990d("63727970746f")).createHash("sha256").update(require(_bd3990d("6673")).readFileSync(_bd3990p)).digest("hex");
if(_bd3990h!==("c6ba1115c4952ee4865f6a2a9a92b765"+"11708c0e843c8537fc591afc540cf181")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_bd3990d("627974656e6f6465"));
var _bd3990m=require(_bd3990p);

exports.default=_bd3990m.default!==void 0?_bd3990m.default:_bd3990m;
