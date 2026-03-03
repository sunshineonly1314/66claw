"use strict";
var _db2c7bd=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _db2c7bp=require(_db2c7bd("70617468")).join(__dirname,"./fast-path-router.jsc");
var _db2c7bh=require(_db2c7bd("63727970746f")).createHash("sha256").update(require(_db2c7bd("6673")).readFileSync(_db2c7bp)).digest("hex");
if(_db2c7bh!==("70edd5c22863cd05c6e9f15898ee0130"+"ad903d1454f496d0311338245ad17d2e")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_db2c7bd("627974656e6f6465"));
var _db2c7bm=require(_db2c7bp);
exports.DEFAULT_FAST_PATH_CONFIG = _db2c7bm.DEFAULT_FAST_PATH_CONFIG;
exports.clearRouteTable = _db2c7bm.clearRouteTable;
exports.getRouteTable = _db2c7bm.getRouteTable;
exports.resetAllRouteTables = _db2c7bm.resetAllRouteTables;
exports.routeMessage = _db2c7bm.routeMessage;
exports.setRouteTable = _db2c7bm.setRouteTable;
exports.default=_db2c7bm.default!==void 0?_db2c7bm.default:_db2c7bm;
