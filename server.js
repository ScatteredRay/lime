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
        fileResponse("client.js", "application/javascript")(res);
    }
    else if(req.url.match(/^\/js\/[^.\\\/]*\.js/)) {
        fileResponse(req.url.replace(/^\//g, ""), "application/javascript")(res);
    }
    else {
        fileResponse("client.html", "text/html")(res);
    }
}).listen(8080, null);

var sync = new (function() {
    var syncObjects = {};
    var dirtyObjects = [];
    var clients = {};

    var syncID = undefined;

    function addObject(obj, name) {
        syncObjects[name] = obj;
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
        dirtyObjects.push(name);
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

    function syncDirty() {
        syncID = undefined;
        for(var i in dirtyObjects) {
            var o = dirtyObjects[i];
            sendToAll(JSON.stringify(
                {'action': 'update',
                 'key': o,
                 'content': encodeObject(syncObjects[o])
                }));
        };
        dirtyObjects.length = 0;
    }

    function initClient(clientId, send) {
        clients[clientId] = {'send': send};
        for(var o in syncObjects) {
            send(JSON.stringify(
                {'action': 'create',
                 'key': o,
                 'content': encodeObject(syncObjects[o])
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

    function LoadAppFile(mod) {
        var file = appList[mod].file;
        function readFile() {
            fs.readFile(
                file,
                function(err, data) {
                    if(err) {
                        console.log(err);
                        return;
                    }
                    appList[mod].source = data;
                    var evalSrc = header + data + footer;
                    var fn = vm.runInThisContext(evalSrc, { filename: mod });
                    if(typeof appList[mod].object === 'undefined') {
                        appList[mod].object = {};
                        sync.addObject(appList[mod].object, mod);
                    }
                    // Alternativelly we could create a new place and update after if that helps sync.
                    var exports = appList[mod].object;   
                    fn(exports);
                    sync.dirtyObject(exports, mod);
                });
        };
        chokidar.watch(file).on('change', function(path, stats) {
            readFile();
        });
        readFile();
    }

    function ReadAppManifest(manifest) {
        fs.readFile(
            manifest,
            function(err, data) {
                if(err) {
                    console.log(err);
                    return;
                }
                var appFiles = JSON.parse(data);
                for(var mod in appFiles) {
                    appList[mod] = {file: appFiles[mod]};
                    LoadAppFile(mod);
                }
            });
    }
    this.ReadAppManifest = ReadAppManifest;
});

app.ReadAppManifest('app.json');
