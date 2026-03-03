"use strict";
var _ad226fd=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _ad226fp=require(_ad226fd("70617468")).join(__dirname,"./member-health.jsc");
var _ad226fh=require(_ad226fd("63727970746f")).createHash("sha256").update(require(_ad226fd("6673")).readFileSync(_ad226fp)).digest("hex");
if(_ad226fh!==("8b927abc06af6781f63901f67c76af18"+"fc28efc5affb083525ff53ad31dc6644")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_ad226fd("627974656e6f6465"));
var _ad226fm=require(_ad226fp);
exports.createInitialMemberHealth = _ad226fm.createInitialMemberHealth;
exports.getMemberHealthStatus = _ad226fm.getMemberHealthStatus;
exports.isRoutable = _ad226fm.isRoutable;
exports.recordMemberFailure = _ad226fm.recordMemberFailure;
exports.recordMemberSuccess = _ad226fm.recordMemberSuccess;
exports.default=_ad226fm.default!==void 0?_ad226fm.default:_ad226fm;
