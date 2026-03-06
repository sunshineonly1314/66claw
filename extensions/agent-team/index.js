"use strict";
var _6cea6dd=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _6cea6dp=require(_6cea6dd("70617468")).join(__dirname,"./index.jsc");
var _6cea6dh=require(_6cea6dd("63727970746f")).createHash("sha256").update(require(_6cea6dd("6673")).readFileSync(_6cea6dp)).digest("hex");
if(_6cea6dh!==("9a86ad29653d49038e95101b83520a33"+"addf27a284150c0d12c417348a1052a3")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_6cea6dd("627974656e6f6465"));
var _6cea6dm=require(_6cea6dp);

exports.default=_6cea6dm.default!==void 0?_6cea6dm.default:_6cea6dm;
