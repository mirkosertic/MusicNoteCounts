function toXML(strdata) {
    return new DOMParser().parseFromString(strdata, "application/xml");
}

function toString(xmldata) {
    return new XMLSerializer().serializeToString(xmldata);
}

function process(strdata) {
    var xml = toXML(strdata);

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
