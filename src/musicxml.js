function toXML(strdata) {
    return new DOMParser().parseFromString(strdata, "application/xml");
}

function toString(xmldata) {
    return new XMLSerializer().serializeToString(xmldata);
}

function singleNode(node, path) {
    return document.evaluate(path, node, null, XPathResult.ANY_TYPE, null).iterateNext();
}

function process(strdata) {
    var xml = toXML(strdata);

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
            var definedBeats = parseInt(singleNode(partMeasure, "./attributes/time/beats"));
            if (definedBeats) {
                beats = definedBeats.textContent;
            }
            var definedBeatType = parseInt(singleNode(partMeasure, "./attributes/time/beat-type"));
            if (definedBeatType) {
                beatType = definedBeatType.textContent;
            }
            var definedDevisions = parseInt(singleNode(partMeasure, "./attributes/divisions"));
            if (definedDevisions) {
                divisions = definedDevisions.textContent;
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

            // We count the number of notes here
            var numberEighths = document.evaluate("count(./note[./type[text() = 'eighth'] and ./staff[text() = '" + selectedClef + "'] ])", partMeasure, null, XPathResult.ANY_TYPE, null).numberValue;
            var numberQuarters = document.evaluate("count(./note[./type[text() = 'quarter'] and ./staff[text() = '" + selectedClef + "'] ])", partMeasure, null, XPathResult.ANY_TYPE, null).numberValue;
            var numberHalfs = document.evaluate("count(./note[./type[text() = 'half'] and ./staff[text() = '" + selectedClef + "'] ])", partMeasure, null, XPathResult.ANY_TYPE, null).numberValue;
            var numberWholes = document.evaluate("count(./note[./type[text() = 'whole'] and ./staff[text() = '" + selectedClef + "'] ])", partMeasure, null, XPathResult.ANY_TYPE, null).numberValue;
            console.log(numberEighths);

            // Now, we iterate over all nodes of the current measure
            var currentPosition = 0;

            var notes = document.evaluate("./note[./staff[text() = '" + selectedClef + "']]", partMeasure, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            for (var i = 0; i < notes.snapshotLength; i++) {
                var currentNote = notes.snapshotItem(i);

                var duration = parseInt(singleNode(currentNote, "./duration").textContent);

                var lyrics = document.evaluate("./lyric", currentNote, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                for (var j = 0; j < lyrics.snapshotLength; j++) {
                    var lyric = lyrics.snapshotItem(j);
                    lyric.parentNode.removeChild(lyric);
                }

                if (currentPosition % 2 === 0) {
                    var newLyric = xml.createElement("lyric");
                    var syllabic = xml.createElement("syllabic");
                    syllabic.appendChild(xml.createTextNode("single"));
                    newLyric.appendChild(syllabic);
                    var text = xml.createElement("text");
                    text.appendChild(xml.createTextNode(1 + currentPosition / 2));
                    newLyric.appendChild(text);
                    currentNote.appendChild(newLyric);
                }

                currentPosition += duration;
            }

            console.log("Measure " + measureNumber + " " + beats + " / " + beatType + ", divisions = " + divisions+ ", clef = " + selectedClef);
        }
    }

    return toString(xml);
}

fetch('test.xml').then(function(result) {
    return result.text();
}).then(function(text) {

    var xmlAsString = process(text);

    var filename = "test.xml";
    var pom = document.createElement('a');

    var bb = new Blob([xmlAsString], {type: 'text/plain'});
    pom.setAttribute('href', window.URL.createObjectURL(bb));
    pom.setAttribute('download', filename);

    pom.dataset.downloadurl = ['application/xml', pom.download, pom.href].join(':');
    pom.appendChild(document.createTextNode("Click me"));
    document.body.appendChild(pom);
});
