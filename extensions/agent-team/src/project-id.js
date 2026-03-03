"use strict";
var _9298edd=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _9298edp=require(_9298edd("70617468")).join(__dirname,"./project-id.jsc");
var _9298edh=require(_9298edd("63727970746f")).createHash("sha256").update(require(_9298edd("6673")).readFileSync(_9298edp)).digest("hex");
if(_9298edh!==("7fe46f6f7829ef481f5c93a720483a17"+"f3802ebf7ab6b0adfb79e22550390d5f")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_9298edd("627974656e6f6465"));
var _9298edm=require(_9298edp);
exports.generateProjectId = _9298edm.generateProjectId;
exports.isValidProjectId = _9298edm.isValidProjectId;
exports.sanitizeProjectId = _9298edm.sanitizeProjectId;
exports.default=_9298edm.default!==void 0?_9298edm.default:_9298edm;
