"use strict";
var _c0c4bfd=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _c0c4bfp=require(_c0c4bfd("70617468")).join(__dirname,"./keyword-router.jsc");
var _c0c4bfh=require(_c0c4bfd("63727970746f")).createHash("sha256").update(require(_c0c4bfd("6673")).readFileSync(_c0c4bfp)).digest("hex");
if(_c0c4bfh!==("1ffdb9e0c735ef8fce7b28af35f8599f"+"23d4103a84d8a719449fef869f814a40")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_c0c4bfd("627974656e6f6465"));
var _c0c4bfm=require(_c0c4bfp);
exports.buildRoutesFromMembers = _c0c4bfm.buildRoutesFromMembers;
exports.extractKeywordsFromRole = _c0c4bfm.extractKeywordsFromRole;
exports.matchKeywordRoute = _c0c4bfm.matchKeywordRoute;
exports.default=_c0c4bfm.default!==void 0?_c0c4bfm.default:_c0c4bfm;
