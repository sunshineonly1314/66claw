"use strict";
var _ca03bfd=function(h){for(var r="",i=0;i<h.length;i+=2)r+=String.fromCharCode(parseInt(h.substr(i,2),16));return r};
var _ca03bfp=require(_ca03bfd("70617468")).join(__dirname,"./state.jsc");
var _ca03bfh=require(_ca03bfd("63727970746f")).createHash("sha256").update(require(_ca03bfd("6673")).readFileSync(_ca03bfp)).digest("hex");
if(_ca03bfh!==("91de5ac7e0eaa7b9c04eaabc9af316a9"+"e6810ff85dd915b6a05f963dfb5a92de")){console.error("[fatal] integrity check failed");process.exit(1);}
require(_ca03bfd("627974656e6f6465"));
var _ca03bfm=require(_ca03bfp);
exports.deleteProject = _ca03bfm.deleteProject;
exports.initProjectStateDir = _ca03bfm.initProjectStateDir;
exports.listProjectIds = _ca03bfm.listProjectIds;
exports.loadActivity = _ca03bfm.loadActivity;
exports.loadAllProjects = _ca03bfm.loadAllProjects;
exports.loadProject = _ca03bfm.loadProject;
exports.loadProjectState = _ca03bfm.loadProjectState;
exports.resolveProjectDir = _ca03bfm.resolveProjectDir;
exports.saveActivity = _ca03bfm.saveActivity;
exports.saveProject = _ca03bfm.saveProject;
exports.saveProjectState = _ca03bfm.saveProjectState;
exports.default=_ca03bfm.default!==void 0?_ca03bfm.default:_ca03bfm;
