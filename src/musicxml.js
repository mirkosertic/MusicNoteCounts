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
    var partIterator = document.evaluate( "/score-partwise[@version = '2.0']/part-list/score-part", xml, null, XPathResult.ANY_TYPE, null);
    var scorePart = partIterator.iterateNext();
    // Now, we iterate over each part
    while (scorePart) {
        var partName = singleNode(scorePart, "./part-name");
        var partId = scorePart.getAttribute("id");

        console.log(partId + " -> " + partName.textContent);

        // The current set time signature
        var beats = undefined;
        var beatType = undefined;
        var divisions = undefined;

        // Now, we iterate over all measures of the current score part
        var partMeasures = document.evaluate("/score-partwise[@version = '2.0']/part[@id = '" + partId + "']/measure", xml, null, XPathResult.ANY_TYPE, null);
        var partMeasure = partMeasures.iterateNext();
        while (partMeasure) {
            var measureNumber = partMeasure.getAttribute("number");

            // Try to decypher the timing signature, as it might change with the current measure
            var definedBeats = singleNode(partMeasure, "./attributes/time/beats");
            if (definedBeats) {
                beats = definedBeats.textContent;
            }
            var definedBeatType = singleNode(partMeasure, "./attributes/time/beat-type");
            if (definedBeatType) {
                beatType = definedBeatType.textContent;
            }
            var definedDevisions = singleNode(partMeasure, "./attributes/divisions");
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

            // Now, we iterate over all nodes of the current measure
            var notesHelper = document.evaluate("./note/staff[text() = '" + selectedClef + "']", partMeasure, null, XPathResult.ANY_TYPE, null);
            var nextNoteHelper = notesHelper.iterateNext();
            while (nextNoteHelper) {
                var currentNote = nextNoteHelper.parentNode;

                // TODO: change lyrics

                nextNoteHelper = notesHelper.iterateNext();
            }

            console.log("Measure " + measureNumber + " " + beats + " / " + beatType + ", divisions = " + divisions+ ", clef = " + selectedClef);
            partMeasure = partMeasures.iterateNext();
        }

        scorePart = partIterator.iterateNext();
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
