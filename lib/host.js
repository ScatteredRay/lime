const fs = require('fs');
const readline = require('readline');

const server = require('./server.js');
const sync = server.sync;

// Test objects.

const app = new(function() {
    var vm = require('vm');
    var chokidar = require('chokidar');
    var watcher;

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
        watcher = chokidar.watch(manifest);
        watcher.on('change', function(path, stats) {
            readAppFile();
        });
        readAppFile();
    }
    this.ReadAppManifest = ReadAppManifest;

    const term = new(function() {
        this.exit = function () {
            console.log("Bai now!");
            //rl.close();
            //watcher.close();
            //server.close();
            // Really close
            process.exit();
        }
        this.log = console.log;
        this.test = {one: { two: 2 }, orange: { three: 3}};
    });

    function lineProc(rl) {
        return (line) => {
            try {
                console.log((function () { with(this) { return eval(line); } }).call(term));
            }
            catch (e)
            {
                console.log(e);
            }
            rl.prompt();
        };
    }

    //TODO: I'm sure there is a better completion function out there, this works for now
    function lineCompleter(line, cb) {
        const idRegex = /([$A-Z_][0-9A-Z_$]*\.?)+$/i;
        let match = idRegex.exec(line);
        if(!match) {
            cb(null, [[], line]);
            return;
        }
        let partialLine = match[0];
        let segments = partialLine.split(".");
        let obj = term;
        let completions = [];
        for(let s of segments) {
            partialLine = s;
            if(s in obj) {
                obj = obj[s]
                completions = [s];
            }
            else {
                completions = Object.keys(obj).filter((t) => t.startsWith(s));
            }
        }
        completions = completions.map(
            (f) => {
                switch(typeof(obj[f])) {
                case 'function':
                    return f + "()";
                case 'object':
                    return f + ".";
                default:
                    return f;
                }
            });
        cb(null, [completions, partialLine]);
    }

    function StartHostTerminal() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: "LIM > ",
            completer: lineCompleter
        });

        rl.prompt();

        rl.on('line', lineProc(rl));
    }
    this.StartHostTerminal = StartHostTerminal;
});

app.ReadAppManifest('app/app.json');
app.StartHostTerminal();
