var syncObjects = {};
var dirtyObjects = [];
var clients = {};

var contentMap = {};

var syncID = undefined;

function addContent(obj, filePath) {
    contentMap[obj] = filePath;
}

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
exports.addObject = addObject

function encodeFunction(fn) {
    return fn.toString();
}

function encodeObject(obj) {
    // We store complex data out-of-line to help prevent bad data attacks.
    var tmp = {'data': {}, 'functions': {}};
    for(var f in obj) {
        if(typeof obj[f] == 'function') {
            tmp.functions[f] = {'value': '(' + encodeFunction(obj[f]) + ')'};
        }
        else {
            tmp.data[f] = obj[f]
        }
    }
    return tmp;
}
exports.encodeObject = encodeObject;

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
exports.dirtyObject = dirtyObject;

function sendCommand(fn) {
    sendToAll(JSON.stringify(
        {'action': 'command',
         'command': encodeFunction(fn)
        }));
}
this.sendCommand = sendCommand;

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
exports.initClient = initClient;

function closeClient(clientId) {
    delete clients[clientId];
}
exports.closeClient = closeClient;
