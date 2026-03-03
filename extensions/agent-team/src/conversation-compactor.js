"use strict";
var _299784d=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _299784p=require(_299784d("70617468")).join(__dirname,"./conversation-compactor.jsc");
var _299784h=require(_299784d("63727970746f")).createHash("sha256").update(require(_299784d("6673")).readFileSync(_299784p)).digest("hex");
if(_299784h!==("5827de17078da2c2a2cf60c94ef83094"+"1c19cb5ed10a3bea8ca1081116ae31c5")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_299784d("627974656e6f6465"));
var _299784m=require(_299784p);
exports.formatActivitySummary = _299784m.formatActivitySummary;
exports.default=_299784m.default!==void 0?_299784m.default:_299784m;
