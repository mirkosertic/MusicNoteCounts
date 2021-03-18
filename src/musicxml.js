function toXML(strdata) {
    return new DOMParser().parseFromString(strdata, "application/xml");
}

function toString(xmldata) {
    return new XMLSerializer().serializeToString(xmldata);
}

function singleNode(node, path) {
    return document.evaluate(path, node, null, XPathResult.ANY_TYPE, null).iterateNext();
}

function addLyric(document, node, text) {
    var newLyric = document.createElement("lyric");
    var syllabic = document.createElement("syllabic");
    syllabic.appendChild(document.createTextNode("single"));
    newLyric.appendChild(syllabic);
    var textNode = document.createElement("text");
    textNode.appendChild(document.createTextNode(text));
    newLyric.appendChild(textNode);
    node.appendChild(newLyric);
}

function process(xml) {
    // Check for all score parts
    var partIterator = document.evaluate( "/score-partwise[@version = '2.0']/part-list/score-part", xml, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    for (var l = 0; l < partIterator.snapshotLength; l++) {
        var scorePart = partIterator.snapshotItem(l);

        var partName = singleNode(scorePart, "./part-name");
        var partId = scorePart.getAttribute("id");

        console.log(partId + " -> " + partName.textContent);

        // The current set time signature
        var beats = undefined;
        var beatType = undefined;
        var divisions = undefined;

        // Now, we iterate over all measures of the current score part
        var partMeasures = document.evaluate("/score-partwise[@version = '2.0']/part[@id = '" + partId + "']/measure", xml, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for (var m = 0; m < partMeasures.snapshotLength; m++) {
            var partMeasure = partMeasures.snapshotItem(m);

            var measureNumber = partMeasure.getAttribute("number");

            // Try to decypher the timing signature, as it might change with the current measure
            var definedBeats = singleNode(partMeasure, "./attributes/time/beats");
            if (definedBeats) {
                beats = parseInt(definedBeats.textContent);
            }
            var definedBeatType = singleNode(partMeasure, "./attributes/time/beat-type");
            if (definedBeatType) {
                beatType = parseInt(definedBeatType.textContent);
            }
            var definedDevisions = singleNode(partMeasure, "./attributes/divisions");
            if (definedDevisions) {
                divisions = parseInt(definedDevisions.textContent);
            }

            // Check for the clef to use
            // We search for the first G-clef. If there is no G-clef, the first clef is used
            var clefCount = document.evaluate("count(./attributes/clef)", partMeasure, null, XPathResult.ANY_TYPE, null).numberValue;
            var selectedClef
            if (clefCount === 1) {
                selectedClef = 1;
            } else {
                var clefs = document.evaluate("./attributes/clef", partMeasure, null, XPathResult.ANY_TYPE, null);
                var clef = clefs.iterateNext();
                while (clef) {
                    if (selectedClef === undefined) {
                        var sign = singleNode(clef, "./sign").textContent;
                        if ("G" === sign) {
                            selectedClef = clef.getAttribute("number");
                        }
                    }
                    clef = clefs.iterateNext();
                }
                if (selectedClef === undefined) {
                    selectedClef  = 1;
                }
            }

            // Now, we iterate over all nodes of the current measure
            var currentPosition = 0;

            // The Stack for currently running triplets
            var tripletStack = [];

            var notes = document.evaluate("./note[./staff[text() = '" + selectedClef + "']]", partMeasure, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            for (var i = 0; i < notes.snapshotLength; i++) {
                var currentNote = notes.snapshotItem(i);

                var duration = parseInt(singleNode(currentNote, "./duration").textContent);

                var timeModificationActualNotes = document.evaluate("./time-modification/actual-notes", currentNote, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                var timeModificationNormalNotes = document.evaluate("./time-modification/normal-notes", currentNote, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

                var lyrics = document.evaluate("./lyric", currentNote, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                for (var j = 0; j < lyrics.snapshotLength; j++) {
                    var lyric = lyrics.snapshotItem(j);
                    lyric.parentNode.removeChild(lyric);
                }

                var checkmark = (divisions * 4 / beatType);

                var remainder = currentPosition % checkmark;

                if (timeModificationActualNotes.snapshotLength > 0 && timeModificationNormalNotes.snapshotLength > 0) {
                    var actualNotes = parseInt(timeModificationActualNotes.snapshotItem(0).textContent);
                    var normalNotes = parseInt(timeModificationNormalNotes.snapshotItem(0).textContent);
                    if (actualNotes === 3) {
                        // We found a triplet
                        var startingTriplets = document.evaluate("./notations/tuplet[@type = 'start']", currentNote, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                        if (startingTriplets.snapshotLength > 0) {
                            tripletStack.push({
                               counter: 0
                            });
                        }
                    }
                }


                if (tripletStack.length === 0 || tripletStack[tripletStack.length - 1].counter === 0) {
                    if (remainder === 0) {
                        addLyric(xml, currentNote, 1 + currentPosition / checkmark);
                    } else if (remainder === checkmark / 2) {
                        addLyric(xml, currentNote, "&");
                    } else if (remainder === checkmark * 0.25) {
                        addLyric(xml, currentNote, "e");
                    } else if (remainder === checkmark * 0.75) {
                        addLyric(xml, currentNote, "a");
                    }
                }

                if (tripletStack.length > 0 ) {
                    var topTriplet = tripletStack[tripletStack.length - 1];
                    if (topTriplet.counter === 1) {
                        addLyric(xml, currentNote, "trip");
                    }
                    if (topTriplet.counter === 2) {
                        addLyric(xml, currentNote, "let");
                        tripletStack.pop();
                    }
                    topTriplet.counter++;
                }

                currentPosition += duration;
            }

            console.log("Measure " + measureNumber + " " + beats + " / " + beatType + ", divisions = " + divisions+ ", clef = " + selectedClef);
        }
    }

    return toString(xml);
}

function loadStep1XML(text) {

    var xml = toXML(text);

    var paras = document.getElementsByClassName('generated');
    while(paras[0]) {
        paras[0].parentNode.removeChild(paras[0]);
    }

    var partIterator = document.evaluate( "/score-partwise[@version = '2.0']/part-list/score-part", xml, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    for (var l = 0; l < partIterator.snapshotLength; l++) {
        var scorePart = partIterator.snapshotItem(l);

        var partName = singleNode(scorePart, "./part-name");
        var partId = scorePart.getAttribute("id");

        var checkdiv = document.createElement("div");
        checkdiv.setAttribute("class", "partselector generated")
        var checkbox = document.createElement("input");
        checkbox.setAttribute("type", "checkbox");
        checkbox.setAttribute("id", "part_" + partId);
        checkbox.setAttribute("checked", "checked");
        checkdiv.append(checkbox);
        var label = document.createElement("label");
        label.setAttribute("for", "part_" + partId);
        label.appendChild(document.createTextNode(partName.textContent));
        checkdiv.appendChild(label);

        document.getElementById("step2").appendChild(checkdiv);
   }

    var button = document.createElement("button");
    button.appendChild(document.createTextNode("Process my score and take me to Step 3!"));
    button.setAttribute("class", "generated")
    button.addEventListener("click", function() {

        var paras = document.getElementById("step3").getElementsByClassName('generated');
        while(paras[0]) {
            paras[0].parentNode.removeChild(paras[0]);
        }

        var xmlAsString = process(xml);
        var filename = "test.xml";
        var pom = document.createElement('a');

        var bb = new Blob([xmlAsString], {type: 'application/xml'});
        var url = window.URL.createObjectURL(bb);
        pom.setAttribute('href', url);
        pom.setAttribute('download', filename);

        pom.dataset.downloadurl = ['application/xml', pom.download, pom.href].join(':');
        pom.appendChild(document.createTextNode("Click me"));
        document.body.appendChild(pom);

        var preview = document.createElement("div");
        preview.setAttribute("class", "preview generated");
        document.getElementById("step3").appendChild(preview);

        var osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(preview, {
            autoResize: false,
            backend: "canvas",
            drawingParameters: "compacttight", // more compact spacing, less padding
            xpageFormat: "A4_P",
            drawUpToMeasureNumber: 12
        });
        var loadPromise = osmd.load(url);
        loadPromise.then(function(){
            osmd.render();

            document.getElementById("step3").removeAttribute("data-disabled");
        });
    });
    document.getElementById("step2").appendChild(button);

    document.getElementById("step2").removeAttribute("data-disabled");
    document.getElementById("step3").setAttribute("data-disabled", "true");
}

function loadExampleDocument() {
    fetch('test.xml').then(function(result) {
        return result.text();
    }).then(function(text) {
        loadStep1XML(text);
    });
}
