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

const server = http.createServer(function(req, res) {
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
});

server.listen(8080, null);

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

exports.close = () => {
    wss.close();
    server.close();
};
exports.sync = sync;
