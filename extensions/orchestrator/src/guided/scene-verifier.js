"use strict";
var _11687ed=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _11687ep=require(_11687ed("70617468")).join(__dirname,"./scene-verifier.jsc");
var _11687eh=require(_11687ed("63727970746f")).createHash("sha256").update(require(_11687ed("6673")).readFileSync(_11687ep)).digest("hex");
if(_11687eh!==("b7b602cfbdb0346420ad3709f461fe0a"+"59876d660ddcff81a00deb58df8d2b5e")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_11687ed("627974656e6f6465"));
var _11687em=require(_11687ep);
exports.formatVerificationReport = _11687em.formatVerificationReport;
exports.verifyScene = _11687em.verifyScene;
exports.default=_11687em.default!==void 0?_11687em.default:_11687em;
