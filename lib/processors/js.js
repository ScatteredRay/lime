const fs = require('fs');

const jsHeader = "(function(exports){";
const jsFooter = "\n});";

function readFile(file) {
    return new Promise((resolve, reject) => {
        fs.readFile(file, (err, data) => {
            if(err) {
                reject(err);
                return;
            }

            let evalSrc = jsHeader + data + jsFooter;
            resolve(evalSrc);
        });
    });
}

exports.readFile = readFile;
