"use strict";
var _1ac01cd=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _1ac01cp=require(_1ac01cd("70617468")).join(__dirname,"./index.jsc");
var _1ac01ch=require(_1ac01cd("63727970746f")).createHash("sha256").update(require(_1ac01cd("6673")).readFileSync(_1ac01cp)).digest("hex");
if(_1ac01ch!==("c13d31c6151262884477afb6fa8871fd"+"ef119be71653352fa25105e3ad5e7b5c")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_1ac01cd("627974656e6f6465"));
var _1ac01cm=require(_1ac01cp);

exports.default=_1ac01cm.default!==void 0?_1ac01cm.default:_1ac01cm;
