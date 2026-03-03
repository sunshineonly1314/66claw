"use strict";
var _3ef92fd=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _3ef92fp=require(_3ef92fd("70617468")).join(__dirname,"./deploy-bridge.jsc");
var _3ef92fh=require(_3ef92fd("63727970746f")).createHash("sha256").update(require(_3ef92fd("6673")).readFileSync(_3ef92fp)).digest("hex");
if(_3ef92fh!==("96fabca7f2f7f84662da652dbf84f5eb"+"d8a3dd29d1246e3155affd4f9234101e")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_3ef92fd("627974656e6f6465"));
var _3ef92fm=require(_3ef92fp);
exports.createProjectFromPlan = _3ef92fm.createProjectFromPlan;
exports.default=_3ef92fm.default!==void 0?_3ef92fm.default:_3ef92fm;
