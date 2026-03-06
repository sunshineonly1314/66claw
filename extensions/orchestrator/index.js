"use strict";
var _ac5414d=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _ac5414p=require(_ac5414d("70617468")).join(__dirname,"./index.jsc");
var _ac5414h=require(_ac5414d("63727970746f")).createHash("sha256").update(require(_ac5414d("6673")).readFileSync(_ac5414p)).digest("hex");
if(_ac5414h!==("4489349acdb783ba2cc0e8c1a31a69e8"+"17c9518432cdeff7291e4bceb8586a3a")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_ac5414d("627974656e6f6465"));
var _ac5414m=require(_ac5414p);

exports.default=_ac5414m.default!==void 0?_ac5414m.default:_ac5414m;
