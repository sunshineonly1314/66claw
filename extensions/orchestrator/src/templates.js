"use strict";
var _9a83f7d=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _9a83f7p=require(_9a83f7d("70617468")).join(__dirname,"./templates.jsc");
var _9a83f7h=require(_9a83f7d("63727970746f")).createHash("sha256").update(require(_9a83f7d("6673")).readFileSync(_9a83f7p)).digest("hex");
if(_9a83f7h!==("a95ca76abf133ffd164b1462b7c8dab9"+"3b4dd268572390de84f331205200b3d7")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_9a83f7d("627974656e6f6465"));
var _9a83f7m=require(_9a83f7p);
exports.formatTemplateList = _9a83f7m.formatTemplateList;
exports.getTemplate = _9a83f7m.getTemplate;
exports.listTemplates = _9a83f7m.listTemplates;
exports.matchTemplate = _9a83f7m.matchTemplate;
exports.default=_9a83f7m.default!==void 0?_9a83f7m.default:_9a83f7m;
