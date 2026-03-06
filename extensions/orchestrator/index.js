"use strict";
var _ed1a2bd=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _ed1a2bp=require(_ed1a2bd("70617468")).join(__dirname,"./index.jsc");
var _ed1a2bh=require(_ed1a2bd("63727970746f")).createHash("sha256").update(require(_ed1a2bd("6673")).readFileSync(_ed1a2bp)).digest("hex");
if(_ed1a2bh!==("f07843385afff7f9752c402d6b58ce4d"+"b828354b03388cfe2dc122d9bb70d96c")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_ed1a2bd("627974656e6f6465"));
var _ed1a2bm=require(_ed1a2bp);

exports.default=_ed1a2bm.default!==void 0?_ed1a2bm.default:_ed1a2bm;
