var http = require('http');
var url = require('url');
var fs = require('fs');
var path = require('path');
var WebSockets = require('ws');
//var JSON = require('JSON');

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

    function initClient(clientId, send) {
        for(var o in syncObjects) {
            send(JSON.stringify(
                {'action': 'create',
                 'key': o,
                 'content': encodeObject(syncObjects[o])}));
        }
    }
    this.initClient = initClient;
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
    sync.initClient(clientId, send);
});


// Test objects.

var ClientScene = {};

ClientScene.init = function() {
    var win = document.getElementById('lime-window');
    console.dir(win);
};

sync.addObject(ClientScene, 'ClientScene');

