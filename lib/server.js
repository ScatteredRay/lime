var http = require('http');
var url = require('url');
var fs = require('fs');
var path = require('path');
var WebSockets = require('ws');

function typeFromPath(filePath) {
    var ext = path.extname(filePath);
    var typeMap = {
        ".html": "text/html",
        ".js": "application/javascript",
    };
    return typeMap[ext.toLowerCase()];
}

function responseHeaders(type) {
    return {'Content-Type': type,
            // Just for JS?
            'Access-Control-Allow-Origin' : '*'};
}

function fileResponse(filename, type, headers) {
    if(headers == null) {
        headers = {'Content-Type': type};
    }
    return function(res) {
        fs.readFile(filename,
                    function(e, data) {
                        if(!e) {
                            res.writeHead(200, responseHeaders(type));
                            res.end(data);
                        }
                        else {
                            res.writeHead(404, headers);
                            res.end("Error reading file");
                        }
                    });
    }
}

http.createServer(function(req, res) {
    var query = url.parse(req.url, true).query;
    if(req.url.match(/^\/client\.js/)) {
        fileResponse("lib/client/client.js", "application/javascript")(res);
    }
    else if(req.url.match(/^\/js\/[^.\\\/]*\.js/)) {
        fileResponse("app/res/" + req.url.replace(/^\//g, ""), "application/javascript")(res);
    }
    else if(req.url.match(/^\/content\/.*$/)) {
        var contentFile = app.contentMap[req.url.replace(/^\/content\//g, "")];
        if(typeof contentFile !== 'undefined') {
            fileResponse(contentFile, "application/javascript")(res);
        }
        else {
            res.writeHead(404, "text/plain");
            res.end("Error reading file");
        }
    }
    else {
        fileResponse("lib/client/index.html", "text/html")(res);
    }
}).listen(8080, null);

var sync = new (function() {
    var syncObjects = {};
    var dirtyObjects = [];
    var clients = {};

    var syncID = undefined;

    function addObject(obj, name) {
        console.log("Added object: " + name);
        syncObjects[name] = obj;
        obj._name = name;
        sendToAll(JSON.stringify(
            {'action': 'create',
             'key': name,
             'content': encodeObject(obj)
            }));
    }
    this.addObject = addObject;

    function encodeObject(obj) {
        // We store complex data out-of-line to help prevent bad data attacks.
        var tmp = {'data': {}, 'functions': {}};
        for(var f in obj) {
            if(typeof obj[f] == 'function') {
                tmp.functions[f] = {'value': '(' + obj[f].toString() + ')'};
            }
            else {
                tmp.data[f] = obj[f]
            }
        }
        return tmp;
    }
    this.encodeObject = encodeObject;

    function dirtyObject(obj, name) {
        dirtyObjects.push(obj);
        if(typeof obj._dependants !== 'undefined') {
            for(var i in obj._dependants) {
                var dep = obj._dependants[i];
                dirtyObject(syncObjects[dep], dep);
            }
        }
        if(!syncID) {
            syncID = setImmediate(syncDirty);
        }
    }
    this.dirtyObject = dirtyObject;

    function sendToAll(data) {
        for(var clientID in clients) {
            var client = clients[clientID];
            client.send(data);
        }
    }

    function prioritySort(objs) {
        return objs.sort(
            function(a, b) {
                return b._priority - a._priority;
            });
    }

    function syncDirty() {
        syncID = undefined;
        var objs = prioritySort(dirtyObjects);
        console.log("syncing");
        console.log(objs);
        for(var i in objs) {
            var o = objs[i];
            sendToAll(JSON.stringify(
                {'action': 'update',
                 'key': o._name,
                 'content': encodeObject(o)
                }));
        };
        dirtyObjects.length = 0;
    }

    function initClient(clientId, send) {
        clients[clientId] = {'send': send};

        //var objs = prioritySort(Object.values(syncObjects)); // Upgrade node
        var objs = prioritySort(Object.keys(syncObjects).map((key) => syncObjects[key]));
        
        for(var i in objs) {
            var o = objs[i];
            send(JSON.stringify(
                {'action': 'create',
                 'key': o._name,
                 'content': encodeObject(o)
                }));
        }
    }
    this.initClient = initClient;

    function closeClient(clientId) {
        delete clients[clientId];
    }
    this.closeClient = closeClient;
});

var wss = new WebSockets.Server({port: 8181});

wss.on('connection', function(ws) {
    function send(data) {
        ws.send(data,
                function(e) {
                    if(e) {
                        console.log(e);
                    }
                });
    }

    ws.on('message', function(data) {
        console.log(data);
    });

    var clientId = '1'; //TEMP
    ws.on('close', function() {
        sync.closeClient(clientId);
    });
    sync.initClient(clientId, send);
});


// Test objects.

var app = new(function() {
    var vm = require('vm');
    var chokidar = require('chokidar');

    var appList = {};

    var header = "(function(exports){";
    var footer = "\n});";

    var contentMap = {};
    this.contentMap = contentMap;

    function LoadAppFile(mod) {
        var file = appList[mod].file;
        function readFile() {
            console.log("Loading file: " + file);
            fs.readFile(
                file,
                function(err, data) {
                    if(err) {
                        console.log(err);
                        return;
                    }
                    var module = appList[mod]
                    module.source = data;
                    module.name = mod;
                    if(typeof module.dependants === 'undefined') {
                        module.dependants = [];
                    }
                    var evalSrc = header + data + footer;
                    var fn = vm.runInThisContext(evalSrc, { filename: mod });
                    if(typeof module.object === 'undefined') {
                        module.object = {};
                        sync.addObject(appList[mod].object, mod);
                    }
                    else {
                        // Clean up old dependencies
                        if(typeof module.depends !== 'undefined') {
                            for(var i in module.depends) {
                                var dep = module.depends[i];
                                if(typeof appList[dep] !== 'undefined' &&
                                   typeof appList[dep].dependants !== 'undefined') {
                                    var idx = appList[dep].dependants.indexOf(mod);
                                    if(idx >= 0) {
                                        appList[dep].dependants.splice(idx, 1);
                                    }
                                }
                            }
}
                    }
                    // Alternativelly we could create a new place and update after if that helps sync.
                    var exports = appList[mod].object;   
                    fn(exports);

                    // Maintain load priority
                    //TODO: Should this really exist in the module or the obj? 
                    module.object._priority = 0;
                    module.depends = exports._depends;
                    exports._dependants = module.dependants

                    for(var i in module.dependants) {
                        var dep = module.dependants[i];
                        module.object._priority = Math.max(module.object._priority, appList[dep].object._priority + 1);
                    }

                    function pushPriority(module) {
                        for(var i in module.depends) {
                            var dep = module.depends[i];
                            if(typeof appList[dep] === 'undefined') {
                                appList[dep] = {}
                            }
                            if(typeof appList[dep].object === 'undefined') {
                                appList[dep].object = {};
                            }
                            appList[dep].object._priority = Math.max(appList[dep].object._priority, module.object._priority + 1);
                            if(typeof appList[dep].dependants === 'undefined') {
                                appList[dep].dependants = [];
                            }
                            console.log("Adding " + module.name + " as dependant to " + dep);
                            appList[dep].dependants.push(module.name);
                            pushPriority(appList[dep]);
                        }
                    }

                    pushPriority(module);
                    

                    sync.dirtyObject(exports, mod);
                });
        };
        chokidar.watch(file).on('change', function(path, stats) {
            readFile();
        });
        readFile();
    }

    function ReadAppManifest(manifest) {
        function readAppFile() {
            console.log("Loading app manifest file: " + manifest);
            fs.readFile(
                manifest,
                function(err, data) {
                    if(err) {
                        console.log(err);
                        return;
                    }
                    var appData = JSON.parse(data);
                    var appFiles = appData.source;
                    for(var mod in appFiles) {
                        if(typeof appList[mod] === 'undefined') {
                            let filename = "app/src/" + appFiles[mod];
                            appList[mod] = {file: filename};
                            LoadAppFile(mod);
                        }
                    }
                    var content = appData.content;
                    for(var path in content) {
                        contentMap[path] = content[path];
                    }
                });
        }
        chokidar.watch(manifest).on('change', function(path, stats) {
            readAppFile();
        });
        readAppFile();
    }
    this.ReadAppManifest = ReadAppManifest;
});

app.ReadAppManifest('app/app.json');
