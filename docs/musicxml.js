var lastClickListener = undefined;

function toXML(strdata) {
    return new DOMParser().parseFromString(strdata, "application/xml");
}

function toString(xmldata) {
    return new XMLSerializer().serializeToString(xmldata);
}

function singleNode(xml, node, path) {
    return xml.evaluate(path, node, null, XPathResult.ANY_TYPE, null).iterateNext();
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

function processMusicXML(xml, partids) {
    // Check all selected score parts
    for (var l = 0; l < partids.length; l++) {
        var partId = partids[l];

        console.log("Processing part -> " + partId);

        // The current set time signature
        var beats = undefined;
        var beatType = undefined;
        var divisions = undefined;

        // Now, we iterate over all measures of the current score part
        var partMeasures = xml.evaluate("/score-partwise[@version = '2.0']/part[@id = '" + partId + "']/measure", xml, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for (var m = 0; m < partMeasures.snapshotLength; m++) {
            var partMeasure = partMeasures.snapshotItem(m);

            var measureNumber = partMeasure.getAttribute("number");

            // Try to decypher the timing signature, as it might change with the current measure
            var definedBeats = singleNode(xml, partMeasure, "./attributes/time/beats");
            if (definedBeats) {
                beats = parseInt(definedBeats.textContent);
            }
            var definedBeatType = singleNode(xml, partMeasure, "./attributes/time/beat-type");
            if (definedBeatType) {
                beatType = parseInt(definedBeatType.textContent);
            }
            var definedDevisions = singleNode(xml, partMeasure, "./attributes/divisions");
            if (definedDevisions) {
                divisions = parseInt(definedDevisions.textContent);
            }

            // Check for the clef to use
            // We search for the first G-clef. If there is no G-clef, the first clef is used
            var clefCount = xml.evaluate("count(./attributes/clef)", partMeasure, null, XPathResult.ANY_TYPE, null).numberValue;
            var selectedClef
            if (clefCount === 1) {
                selectedClef = 1;
            } else {
                var clefs = xml.evaluate("./attributes/clef", partMeasure, null, XPathResult.ANY_TYPE, null);
                var clef = clefs.iterateNext();
                while (clef) {
                    if (selectedClef === undefined) {
                        var sign = singleNode(xml, clef, "./sign").textContent;
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

            var notes = xml.evaluate("./note[./staff[text() = '" + selectedClef + "']]", partMeasure, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            for (var i = 0; i < notes.snapshotLength; i++) {
                var currentNote = notes.snapshotItem(i);

                // Ignore grace notes, as they have no duration
                var grace = singleNode(xml, currentNote, "./grace");
                if (grace === null) {
                    var duration = parseInt(singleNode(xml, currentNote, "./duration").textContent);

                    var timeModificationActualNotes = xml.evaluate("./time-modification/actual-notes", currentNote, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                    var timeModificationNormalNotes = xml.evaluate("./time-modification/normal-notes", currentNote, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

                    var lyrics = xml.evaluate("./lyric", currentNote, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
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
                            var startingTriplets = xml.evaluate("./notations/tuplet[@type = 'start']", currentNote, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
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

                    if (tripletStack.length > 0) {
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
            }

            console.log("Measure " + measureNumber + " " + beats + " / " + beatType + ", divisions = " + divisions+ ", clef = " + selectedClef);
        }
    }

    return toString(xml);
}

function clearGenerated() {
    var generatedDOMNodes = document.getElementsByClassName('generated');
    while(generatedDOMNodes[0]) {
        generatedDOMNodes[0].parentNode.removeChild(generatedDOMNodes[0]);
    }
}

function addTrackSelector(name,id) {
    var checkdiv = document.createElement("div");
    checkdiv.setAttribute("class", "partselector generated")
    var checkbox = document.createElement("input");
    checkbox.setAttribute("type", "checkbox");
    checkbox.setAttribute("value", id);
    checkbox.setAttribute("checked", "checked");
    checkdiv.append(checkbox);
    var label = document.createElement("label");
    label.setAttribute("for", "part_" + id);
    label.appendChild(document.createTextNode(name));
    checkdiv.appendChild(label);

    document.getElementById("step2").appendChild(checkdiv);
}

function addProcessButton(clickhandler) {
    var button = document.createElement("button");
    button.appendChild(document.createTextNode("Process my score and take me to Step 3!"));
    button.setAttribute("class", "generated")
    button.addEventListener("click", clickhandler);
    document.getElementById("step2").appendChild(button);
}

function selectedTracks() {
    var selectedtracks = [];
    var checkboxes = document.querySelectorAll('input[type=checkbox]:checked')
    for (var i = 0; i < checkboxes.length; i++) {
        selectedtracks.push(checkboxes[i].value)
    }
    return selectedtracks;
}

function loadStep1MusicXML(xml) {

    clearGenerated();

    var partIterator = xml.evaluate( "/score-partwise[@version = '2.0']/part-list/score-part", xml, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    for (var l = 0; l < partIterator.snapshotLength; l++) {
        var scorePart = partIterator.snapshotItem(l);

        var partName = singleNode(xml, scorePart, "./part-name").textContent;
        var partId = scorePart.getAttribute("id");

        addTrackSelector(partName, partId);
    }

    addProcessButton(function() {

        var paras = document.getElementById("step3").getElementsByClassName('generated');
        while(paras[0]) {
            paras[0].parentNode.removeChild(paras[0]);
        }

        // Select all checked input boxes
        var selectedtracks = selectedTracks();

        var xmlAsString = processMusicXML(xml, selectedtracks);

        var downloadlink = document.getElementById("downloadlink");

        var filename = "download.xml";
        var bb = new Blob([xmlAsString], {type: 'application/xml'});
        var url = window.URL.createObjectURL(bb);
        downloadlink.setAttribute('href', url);
        downloadlink.setAttribute('download', filename);
        downloadlink.dataset.downloadurl = ['application/xml', filename, url].join(':');

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
        osmd.load(url).then(function(){
            osmd.render();
            document.getElementById("step3").removeAttribute("data-disabled");
        });
    });

    document.getElementById("step2").removeAttribute("data-disabled");
    document.getElementById("step3").setAttribute("data-disabled", "true");
}

function loadStep1GuitarPro(zip,xml) {

    clearGenerated();

    var masterTracks = singleNode(xml, xml, "/GPIF/MasterTrack/Tracks").textContent.split(" ");
    for (var i = 0; i < masterTracks.length;i++) {
        var partId = masterTracks[i];
        var partName = singleNode(xml, xml, "/GPIF/Tracks/Track[@id = '" + partId + "']/Name").textContent;

        addTrackSelector(partName, partId);
    }
}

function loadExampleMusicXMLDocument() {
    return fetchRemoteDocument("test.xml");
}

function fetchRemoteDocument(name) {
    if (name.endsWith(".xml")) {
        fetch(name).then(function (result) {
            return result.text();
        }).then(function (text) {
            loadStep1MusicXML(toXML(text));
        });
    } else if (name.endsWith(".gp")) {
        fetch(name).then(JSZip.loadAsync).then(function(zip) {
            zip.file("Content/score.gpif").async("text").then(function(text) {
                var xml = toXML(text);
                loadStep1GuitarPro(zip, xml);
            });
        });
    }
    return true;
}

function fetchMusicXMLFile(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
        loadStep1MusicXML(toXML(e.target.result));
    };
    reader.readAsText(file);
}

function fetchGuitarProFile(file) {
    // Stored as a zip,
    JSZip.loadAsync(file).then(function(zip) {
        zip.file("Content/score.gpif").async("text").then(function(text) {
            var xml = toXML(text);
            loadStep1GuitarPro(zip, xml);
        });
    });
}

function fetchFile(file) {
    if (file.name.endsWith(".xml")) {
        // MusicXML file
        fetchMusicXMLFile(file);
    } else if (file.name.endsWith(".gp")) {
        // Guitar pro file
        fetchGuitarProFile(file);
    }
}

document.getElementById("loadexample").onclick = function(event) {
    event.stopPropagation();
    loadExampleMusicXMLDocument();
}

document.getElementById("fileupload").addEventListener("change", function() {
    var selectedFiles = this.files;
    if (selectedFiles.length === 1) {
        var file = selectedFiles[0];
        fetchFile(file);
    }
}, false);

var step1 = document.getElementById("step1");
step1.addEventListener("click", function() {
    document.getElementById("fileupload").click();
});
step1.addEventListener("dragover", function(e) {
    e.preventDefault();
}, false);
step1.addEventListener("drop", function(e) {
    e.preventDefault();
    var dt = e.dataTransfer;
    var files = dt.files;
    if (files.length === 1) {
        var file = files[0];
        fetchFile(file);
    }
}, false)
