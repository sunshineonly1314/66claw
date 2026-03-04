"use strict";
var _3923a1d=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _3923a1p=require(_3923a1d("70617468")).join(__dirname,"./index.jsc");
var _3923a1h=require(_3923a1d("63727970746f")).createHash("sha256").update(require(_3923a1d("6673")).readFileSync(_3923a1p)).digest("hex");
if(_3923a1h!==("d78aa79a6205668a2ac2eb1e4730b083"+"12cb72054df4433e7d65a950326bd9ab")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_3923a1d("627974656e6f6465"));
var _3923a1m=require(_3923a1p);

exports.default=_3923a1m.default!==void 0?_3923a1m.default:_3923a1m;
