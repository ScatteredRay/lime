const fs = require('fs');
const path = require('path');
const readline = require('readline');
const chokidar = require('chokidar');

const server = require('./server.js');
const sync = require('./sync.js');

// Test objects.

const app = new(function() {
    var vm = require('vm');
    var watcher;

    var appList = {};

    let processorMap = {}
    let processorExtensionMap = {}

    function LoadProcessor(file) {
        if(file in processorMap) {
            return;
        }
        let filePath = `./processors/${file}`;
        function load() {
            try {
                delete require.cache[require.resolve(filePath)]
            }
            catch {
            }
            processorMap[file] = require(filePath);
        }
        chokidar.watch(require.resolve(filePath)).on('change', function(filePath, stats) {
            load();
        });
        load();
    }

    function LoadAppFile(mod) {
        var file = appList[mod].file;
        function readFile() {
            console.log("Loading file: " + file);
            let fileExt = path.extname(file).toLowerCase();
            let processorName = processorExtensionMap[fileExt];
            let processor = processorMap[processorName];
            function onProcessedData (data) {
                let module = appList[mod]
                module.source = data;
                module.name = mod;
                if(typeof module.dependants === 'undefined') {
                    module.dependants = [];
                }
                let evalSrc = data;
                var fn = vm.runInThisContext(evalSrc, { filename: mod });
                if(typeof module.object === 'undefined') {
                    module.object = {};
                    sync.addObject(appList[mod].object, mod);
                }
                else {
                    // Clean up old dependencies
                    if(typeof module.depends !== 'undefined') {
                        for(let i in module.depends) {
                            let dep = module.depends[i];
                            if(typeof appList[dep] !== 'undefined' &&
                               typeof appList[dep].dependants !== 'undefined') {
                                let idx = appList[dep].dependants.indexOf(mod);
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
            }

            processor.readFile(file)
                .then(onProcessedData)
                .catch((err) => {
                    console.log(`Error reading file ${file}:`, err);
                });
        };
        chokidar.watch(file).on('change', function(filePath, stats) {
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
                    let appData = JSON.parse(data);
                    let appProcessors = appData.processors;
                    for(let extension in appProcessors) {
                        let processorFile = appProcessors[extension];
                        processorExtensionMap[extension.toLowerCase()] = processorFile;
                        LoadProcessor(processorFile);
                    }
                    let appFiles = appData.source;
                    for(let mod in appFiles) {
                        if(typeof appList[mod] === 'undefined') {
                            let filename = "app/src/" + appFiles[mod];
                            appList[mod] = {file: filename};
                            LoadAppFile(mod);
                        }
                    }
                    let content = appData.content;
                    for(let obj in content) {
                        sync.addContent(obj, content[obj]);
                    }
                });
        }
        watcher = chokidar.watch(manifest);
        watcher.on('change', function(filePath, stats) {
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
        this.refresh = function() {
            sync.sendCommand(() => {
                window.location.reload()
            });
        }
        this.log = console.log;
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
