"use strict";
var _796a89d=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _796a89p=require(_796a89d("70617468")).join(__dirname,"./soul-validator.jsc");
var _796a89h=require(_796a89d("63727970746f")).createHash("sha256").update(require(_796a89d("6673")).readFileSync(_796a89p)).digest("hex");
if(_796a89h!==("7062212c813ba3603ca494320303e0c6"+"a8758bebe3e245aa904e75c3d81d19cc")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_796a89d("627974656e6f6465"));
var _796a89m=require(_796a89p);
exports.buildSoulGenerationPrompt = _796a89m.buildSoulGenerationPrompt;
exports.validateSoulStructure = _796a89m.validateSoulStructure;
exports.default=_796a89m.default!==void 0?_796a89m.default:_796a89m;
