"use strict";
var _41ae7ed=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _41ae7ep=require(_41ae7ed("70617468")).join(__dirname,"./usage-guide.jsc");
var _41ae7eh=require(_41ae7ed("63727970746f")).createHash("sha256").update(require(_41ae7ed("6673")).readFileSync(_41ae7ep)).digest("hex");
if(_41ae7eh!==("936efe46a8e993e1445238d3b1e2007c"+"bee10edbc33db52e01c8b0b98d4355d5")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_41ae7ed("627974656e6f6465"));
var _41ae7em=require(_41ae7ep);
exports.generateUsageGuide = _41ae7em.generateUsageGuide;
exports.default=_41ae7em.default!==void 0?_41ae7em.default:_41ae7em;
