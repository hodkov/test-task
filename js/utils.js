// HTTP
function getHttp(url) {
    return new Promise((resolve, reject) => {
        var request = new XMLHttpRequest();
        request.onreadystatechange = function () {
            if (request.readyState != 4) {
                return;
            }

            if (request.status == 200) {
                resolve(request.responseText);
            } else {
                reject(new Error("Request error: status " + request.status + ", text " + request.statusText));
            }
        }
        request.open("GET", url);
        request.send();
    });
}

function getJson(url) {
    return getHttp(url).then((result) => JSON.parse(result));
}

// lodash и т.п. нельзя, поэтому свой велосипед
function chunk(arr, size) {
    var result = [];
    var currentChunk;
    for (var i = 0; i < arr.length; i++) {
        if (i % size == 0) {
            currentChunk = [];
            result.push(currentChunk);
        }
        currentChunk.push(arr[i]);
    }

    return result;
}

// animation
function animate(target, time, toValues) {
    var beginValues = {};
    var propsList = [];
    //TODO: тут может быть не только PlainObject
    for (var prop in toValues) {
        beginValues[prop] = target[prop];
        propsList.push(prop);
    }

    function getNextValue(step, stepsTotal, begin, end) {
        return begin + (end - begin) * (1 - Math.pow(2, -10 * step / stepsTotal));
    }

    var stepsTotal = Math.ceil(0.06 * time); //fps = 60
    return new Promise((resolve, reject) => {
        var counter = stepsTotal;
        for (var i = 0; i < stepsTotal; i++) {
            setTimeout((step, total) => {
                counter--;
                if (counter > 0) {
                    for (var prop of propsList) {
                        var begin = beginValues[prop];
                        var end = toValues[prop];
                        var nextValue = getNextValue(step, total, begin, end);
                        target[prop] = Math.abs((end - nextValue) / (end - begin)) > 0.005 ? nextValue : end;
                    }
                } else {
                    for (var prop of propsList) {
                        target[prop] = toValues[prop];
                    }
                    resolve();
                }
            }, Math.ceil(100 * i / 6), i, stepsTotal);
        }
    });
}
