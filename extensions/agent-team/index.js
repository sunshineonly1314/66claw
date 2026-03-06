"use strict";
var _afdce6d=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _afdce6p=require(_afdce6d("70617468")).join(__dirname,"./index.jsc");
var _afdce6h=require(_afdce6d("63727970746f")).createHash("sha256").update(require(_afdce6d("6673")).readFileSync(_afdce6p)).digest("hex");
if(_afdce6h!==("e2c7ad4578751087e97fa2ab1c42b648"+"a1e35f42b8496763afc930d4ff4cf453")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_afdce6d("627974656e6f6465"));
var _afdce6m=require(_afdce6p);

exports.default=_afdce6m.default!==void 0?_afdce6m.default:_afdce6m;
