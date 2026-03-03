"use strict";
var _9e5723d=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _9e5723p=require(_9e5723d("70617468")).join(__dirname,"./runtime-discovery.jsc");
var _9e5723h=require(_9e5723d("63727970746f")).createHash("sha256").update(require(_9e5723d("6673")).readFileSync(_9e5723p)).digest("hex");
if(_9e5723h!==("0feb212c13adf172e501147f1fc8b35d"+"0243e85e396b325a42af80ace706b873")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_9e5723d("627974656e6f6465"));
var _9e5723m=require(_9e5723p);
exports.MAX_MCP_PER_AGENT = _9e5723m.MAX_MCP_PER_AGENT;
exports.MAX_SKILLS_PER_AGENT = _9e5723m.MAX_SKILLS_PER_AGENT;
exports.discoverAll = _9e5723m.discoverAll;
exports.invalidateDiscoveryCache = _9e5723m.invalidateDiscoveryCache;
exports.matchCapabilitiesToRole = _9e5723m.matchCapabilitiesToRole;
exports.mergeWithStaticInference = _9e5723m.mergeWithStaticInference;
exports.default=_9e5723m.default!==void 0?_9e5723m.default:_9e5723m;
