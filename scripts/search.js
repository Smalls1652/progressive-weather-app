function getSearchResults() {

    var searchQuery = document.getElementById("searchBox").value;

    if (/(?<city>(.*),(.*))/i.test(searchQuery)) {

       var parsedCity = /(?<full>(?<city>.*),(?<state>.*))/i.exec(searchQuery);
        
        var apiCall = "https://nominatim.openstreetmap.org/search?format=jsonv2&namedetails=1&city=" + encodeURIComponent(parsedCity.groups.city) + "&state=" + encodeURIComponent(parsedCity.groups.state) + "&countrycodes=US";

        $.getJSON(apiCall).done(function (data) {
            parseSearchResults(data);
        });
    }
    else if (/(?<zipcode>\d{5})/.test(searchQuery)) {

        var parsedZip = /(?<zipcode>\d{5})/i.exec(searchQuery);

        var apiCall = "https://nominatim.openstreetmap.org/search?format=jsonv2&namedetails=1&postalcode=" + encodeURIComponent(parsedZip.groups.zipcode) + "&countrycodes=US";

        $.getJSON(apiCall).done(function (data) {
            parseSearchResults(data);
        });
    }
    else {
        var apiCall = "https://nominatim.openstreetmap.org/search?format=jsonv2&namedetails=1&q=" + encodeURIComponent(searchQuery) + "&countrycodes=US";

        $.getJSON(apiCall).done(function (data) {
            parseSearchResults(data);
        });
    }
}

function parseSearchResults(q) {
    $("#list").html("");
    var searchList = {};
    $.each(q, function (key, val) {
        searchList[key] = {
            "location": val.display_name,
            "coord": val.lat + ", " + val.lon
        };

        $("#list").append("<div onclick=\"setLocationName(" + key + ")\">" + val.display_name + "</div>")
    });

    localforage.setItem("Location Search Results", searchList);
}

function setLocationName(s) {

    localforage.getItem("Location Search Results").then(function (dbData) {
        var askedName = prompt("Set friendly name:");

        var finalData = {
            "location": askedName,
            "coord": dbData[s].coord
        };
        console.log(finalData);
        localforage.removeItem("Location Search Results");

    });
}