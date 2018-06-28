//NWS Data Gather Functions
async function runWeatherData(selectedLocation, isCurrentLocation, callback) {
    //This is the main function for data gathering from the NWS.

    var gatheredData = {};
    if (isCurrentLocation) {
        await getCurrentLocation(async function (point) {
            gatheredData = {
                "location": {
                    "latitude": point.coords.latitude,
                    "longitude": point.coords.longitude
                }
            };
            await gatherWeatherData(gatheredData.location, async function (z) {
                gatheredData.nwsdata = {
                    "afd": z.afd,
                    "alerts": z.alerts,
                    "station": z.station,
                    "current": z.current,
                    "hrs": z.hrs,
                    "forecast": z.forecast,
                    "point": z.point
                };
                console.log("Finalized.")
                await addWeatherData(true, gatheredData);
                callback(gatheredData);
            });
        });
    }
    else {
        await localforage.getItem(selectedLocation).then(async function (dbData) {

            gatheredData = {
                "location": {
                    "latitude": dbData.location.latitude,
                    "longitude": dbData.location.longitude
                }
            };

            await gatherWeatherData(gatheredData.location, async function (z) {
                gatheredData.nwsdata = {
                    "afd": z.afd,
                    "alerts": z.alerts,
                    "station": z.station,
                    "current": z.current,
                    "hrs": z.hrs,
                    "forecast": z.forecast,
                    "point": z.point
                };
                console.log("Finalized.")
                await addWeatherData(false, gatheredData, selectedLocation);
                callback(gatheredData);
            });
        });
    }
}

async function gatherWeatherData(location, callback) {
    //Gathering the nwsdata portion of the weather data.

    var dd = {};
    console.log("Grabbing point data from NWS...");
    await getPointData(location, async function (nwsPoint) {
        console.log(nwsPoint);
        dd.point = nwsPoint;

        await getWeatherStation(nwsPoint, async function (nwsWthrStn) {
            dd.station = nwsWthrStn;

            await getCurrentWeather(nwsPoint, async function (nwsCurWeather) {
                dd.current = nwsCurWeather;

                await getAlertsData(nwsPoint, async function (nwsAlerts) {
                    console.log("Gathing alerts in the area from NWS...");
                    dd.alerts = nwsAlerts;

                    await getAFDList(nwsPoint, async function (nwsAFDList) {
                        console.log("Getting the most recent AFD text from the local NWS office...");
                        await getAFDText(nwsAFDList['@graph'][0].id, async function (nwsAFDText) {
                            dd.afd = {
                                "issuedTime": nwsAFDText.issuanceTime,
                                "productText": nwsAFDText.productText.replace(/\\n/g, "<br />")
                            };

                            await getHourlyForecast(nwsPoint, async function (nwsHrly) {
                                console.log("Getting current weather and hourly forecast data from NWS...");

                                var returnHourly = [];

                                $.each(nwsHrly.properties.periods.slice(0, 13), function (key, val) {
                                    returnHourly.push({
                                        "hour": val.startTime,
                                        "temp": val.temperature,
                                        "icon": val.icon,
                                        "condition": val.shortForecast,
                                        "isDayTime": val.isDaytime
                                    });
                                });

                                dd.hrs = returnHourly;

                                await getNextFiveDays(nwsPoint, async function (nwsWeek) {
                                    console.log("Getting the next five days from NWS...");
                                    var returnData = [];
                                    $.each(nwsWeek.properties.periods, function (key, val) {
                                        returnData.push({
                                            "dayName": val.name,
                                            "isDaytime": val.isDaytime,
                                            "icon": val.icon,
                                            "temp": val.temperature,
                                            "detailedForecast": val.detailedForecast,
                                            "shortForecast": val.shortForecast
                                        });
                                    });
                                    dd.forecast = returnData;

                                    callback(dd);
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}

async function getPointData(point, callback) {

    var apiCall = "https://api.weather.gov/points/" + point.latitude + "," + point.longitude;

    $.getJSON(apiCall).done(await function (data) {
        callback({
            "office": data.properties.cwa,
            "county": data.properties.county,
            "forecast": data.properties.forecast,
            "hrfore": data.properties.forecastHourly,
            "stations": data.properties.observationStations,
            "properties": data.properties
        });
    });
}

async function getWeatherStation(apiCall, callback) {

    $.getJSON(apiCall.stations, async function (data) {
        $.getJSON(data.features[0].id, await function (d1) {
            console.log(d1);
            callback(d1.properties);
        });
    });

}

async function getCurrentWeather(apiCall, callback) {
    //Gathering current weather data for the location

    $.getJSON(apiCall.stations, async function (data) {
        $.getJSON(data.features[0].id + "/observations/current", function (d2) {
            callback(d2);
        });
    });

}

async function getAFDList(apiCall, callback) {
    //Gathering the Area Forecast Discussion (AFD) product list from the location's NWS Office.

    console.log(apiCall.office);
    $.getJSON("https://api.weather.gov/products/types/AFD/locations/" + apiCall.office, await function (data) {
        console.log(data);
        callback(data);

    });

}

async function getAlertsData(apiCall, callback) {
    //Gathering weather alerts for the location
    $.getJSON(apiCall.county, async function (data) {

        $.getJSON("https://api.weather.gov/alerts/active/zone/" + data.properties.id, await function (aldt) {
            callback(aldt);
        });

    });

}

async function getAFDText(apiCall, callback) {
    //Gathering data for the Area Forecast Discussion (AFD) product text for a particular issuance time.

    $.getJSON("https://api.weather.gov/products/" + apiCall, await function (data) {

        callback(data);

    });

}

async function getHourlyForecast(apiCall, callback) {
    //Gathering hourly forecast data for the location.

    $.getJSON(apiCall.hrfore, await function (data) {

        callback(data);

    });

}

async function getNextFiveDays(apiCall, callback) {
    //Gathering the weekly forecast for the next five days.

    $.getJSON(apiCall.forecast, await function (data) {

        callback(data);

    });

}

//Data placement on page functions

function placeCurrentWeather(d) {
    $("#weatherIcon").html("<i class=\"currentConditionIcon current-cond-icon wi " + shortForecastIcon(d.nwsdata.current.properties.icon, true) + "\"></i>");
    $(".weatherStation").text("From " + ((d.nwsdata.station.name).split(", ")[1]) + " [" + d.nwsdata.station.stationIdentifier + "]");
    $(".currentCondition").text(d.nwsdata.current.properties.textCondition);
    $("#WhereAmI").text(d.nwsdata.point.properties.relativeLocation.properties.city + ", " + d.nwsdata.point.properties.relativeLocation.properties.state);
    $(".currentTemp").html((Math.round(d.nwsdata.current.properties.temperature.value * 1.8 + 32)) + " &#8457;");

    var curCondTbl = `
    <table class="table table-sm table-borderless">
    <tbody>
        <tr>
        <th scope="row" class="text-left">Wind</th>
        <td class="text-left">` + Math.round(d.nwsdata.current.properties.windSpeed.value) + ` MPH</td>
        </tr>
        <tr>
        <th scope="row" class="text-left">Humidity</th>
        <td class="text-left">` + Math.round(d.nwsdata.current.properties.relativeHumidity.value) + `%</td>
        </tr>
        <th scope="row" class="text-left">Pressure</th>
        <td class="text-left">` + Math.round((d.nwsdata.current.properties.barometricPressure.value * 0.01)) + ` mb (` + Math.round((d.nwsdata.current.properties.barometricPressure.value * 0.00029529983071)) + ` in)</td>
        </tr>
        </tbody>
    </table>`;

    $("#curCondTbl").html(curCondTbl);
}

function placeAFD(d) {
    $("#afdText").html(d.nwsdata.afd.productText);
}

function placeWeatherAlerts(d) {
    $("#weatherAlerts").html(null);

    if (d.nwsdata.alerts.features) {
        $.each(d.nwsdata.alerts.features, async function (key, val) {
            console.log("Placing alert" + val.properties.headline);
            var alertLevel;
            if (val.properties.severity == "Minor") {
                alertLevel = "alert-secondary";
            } else if (val.properties.severity == "Severe") {
                alertLevel = "alert-danger";
            } else {
                alertLevel = "alert-warning";
            }

            var alertCode = `
            <div id="alert-` + val.properties.id + `" class="alertCard alert ` + alertLevel + `" role="alert">` + val.properties.headline + `<div id="collpasedAlert-` + val.properties.id + `" class="collapse">
            ` + val.properties.description + `</div></div>
            `;

            $("#weatherAlerts").append(alertCode);
            $("#alert-" + val.properties.id).click(function () {
                if (!($("#collpasedAlert-" + val.properties.id).hasClass("show"))) {
                    $("#collpasedAlert-" + val.properties.id).collapse("show");
                    $("html,body").animate({
                        scrollTop: ($("#alert-" + val.properties.id).offset().top - $("body").css("padding-top").replace("px", "") - 5)
                    });
                } else {
                    $("#collpasedAlert-" + val.properties.id).collapse("hide");
                    $("html,body").animate({
                        scrollTop: ($("#alert-" + val.properties.id).offset().top - $("body").css("padding-top").replace("px", "") - 5)
                    });
                }
            });

        });
    }
}

function placeHourlyForecast(d) {
    var hourlyHours = "";
    var hourlyIcons = "";
    var hourlyTemps = "";
    var hourlyPct = "";
    var hourlyConditions = "";

    $.each(d.nwsdata.hrs.slice(0, 12), async function (key, val) {
        var h = new Date(val.hour).getHours();
        var ampm = h >= 12 ? 'PM' : 'AM';

        h = h % 12;
        h = h ? h : 12;

        var regexURL = (/^https:\/\/api\.weather\.gov\/icons\/.*?\/(?:day|night)\/(.*?)$/).exec(val.icon);
        //console.log(regexURL);
        var regexIcons = (/(?:(?<condition1>.*)\/(?<condition2>.*?)|(?<condition>.*))(?=\?size=.*)/).exec(regexURL[1]);

        //console.log(val.icon);
        //console.log(regexIcons);
        var pctChance;

        if (regexIcons.groups['condition1'] && regexIcons.groups['condition2']) {
            //console.log("Two conditions");
            var pct1;
            var pct2;
            if ((/^(?:.*?,)(?<chance>.*)$/).exec(regexIcons.groups['condition1'])) {
                pct1 = (/^(?:.*?,)(?<chance>.*)$/).exec(regexIcons.groups['condition1'])[1];
            }
            else {
                pct1 = 0;
            }
            if ((/^(?:.*?,)(?<chance>.*)$/).exec(regexIcons.groups['condition2'])) {
                pct2 = (/^(?:.*?,)(?<chance>.*)$/).exec(regexIcons.groups['condition2'])[1];
            }
            else {
                pct2 = 0;
            }

            if (pct1 && pct2) {
                if (pct1 > pct2) {
                    pctChance = pct1 + "%";
                }
                else if (pct2 > pct1) {
                    pctChance = pct2 + "%";
                }
            }
            else if (pct1) {
                pctChance = pct1 + "%";
            }
            else if (pct2) {
                pctChance = pct2 + "%";
            }
        }
        else if (regexIcons.groups['condition']) {
            //console.log(regexIcons.groups['condition']);
            //console.log("One condition");
            var ptc = regexIcons.groups['condition'];
            //console.log(ptc);
            if ((/^(?:.*?,)(?<chance>.*)$/).test(ptc)) {
                //console.log("Chance found.");
                pctChance = (/^(?:.*?,)(?<chance>.*)$/).exec(ptc)[1] + "%";

            }
            else {
                //console.log("Chance not found.");
                pctChance = "";
            }

        }
        else {
            pctChance = "";
        }


        hourlyHours += "<th scope=\"col\" class=\"hrHeader\">" + h + " " + ampm + "</th>";
        hourlyIcons += "<td class=\"hrHeader\"><i class=\"hourlyIcon wi " + shortForecastIcon(val.icon, val.isDayTime) + "\"></i></td>";
        hourlyPct += "<td class=\"hrHeader\"><span class=\"hourlyTemp\">" + pctChance + "</span></td>";
        hourlyTemps += "<td class=\"hrHeader\"><span class=\"hourlyTemp\">" + val.temp + " &#8457;</span></td>";
        hourlyConditions += "<td class=\"hrHeader\"><p>" + val.condition + "</p></td>";

    });

    var hourlyTable = `
        <table class="table table-borderless">
        <thead>
            <tr>
            ` + hourlyHours + `
            </tr>
        </thead>
        <tbody>
        <tr>
        ` + hourlyTemps + `
    </tr>
            <tr>
                ` + hourlyIcons + `
            </tr>
            <tr>
                ` + hourlyPct + `
            </tr>
        </tbody>
        </table>`;

    $("#hourlyTbl").html(hourlyTable);
}

function placeWeeklyForecast(d) {

    $(".forecastList").html(null);

    $.each(d.nwsdata.forecast, async function (key, val) {
        var dName = val.dayName;
        var dateName = val.dayName.replace(/\s/g, '');

        var highlow;

        if (val.isDaytime) {
            highlow = "highTemp";
        } else {
            highlow = "lowTemp";
        }

        var pctChanceString;

        if ((/Chance of precipitation is (.*)%\./).test(val.detailedForecast)) {
            var pctChance = (/Chance of precipitation is (.*)%\./).exec(val.detailedForecast)[1];

            pctChanceString = "(Chance is " + pctChance + "%)";

        } else {
            pctChanceString = "";
        }

        var forecastCardCode = `
        <div id="fCard-` + dateName + `" class="pb-3 pl-1 pr-1 col-sm-6 col-md-6 flex-column flex-fill">
        <div class="card forecastCard">
        <div class="card-header">
        <h4>` + val.dayName + `
        </h4>
        </div>
        <div class=\"card card-body\">
        <div class="row">
        <div class=\"col-lg-4 col-4 p-0 text-center\">
            <p><i class=\"forecasticon wi ` + shortForecastIcon(val.icon, val.isDaytime) + `\"></i></p>
            <p class=\"forecastTempFont ` + highlow + `\">` + val.temp + ` &#8457;</p>
        </div>
        <div class="col p-0 align-self-center">
            <p class="forecastShortFont">` + val.shortForecast + ` ` + pctChanceString + `</p>
        </div>
    </div>
        <div class=\"collapse\" id=\"forecast-` + dateName + `\">
                <div>
                    <div class="\col\">
                        <hr>
                    </div>
                </div>
                <div class="forecastFont">
                    <div class=\"col\">
                        <p class="text-left">` + val.detailedForecast + `</p>
                </div>
            </div>
        </div>
    </div>
    </div>
    </div>`;

        //$(".forecastList").append("<h4><a role=\"button\" href=\"#forecast" + dateName + "\" data-toggle=\"collapse\" data-target=\"#forecast" + dateName + "\" aria-expanded=\"false\" aria-controls=\"forecast" + dateName + "\">" + val.name + "</a></h4>");
        //$(".forecastList").append("<div class=\"card card-body\"><div class=\"row align-items-center\"><div class=\"col text-left\"><img src=\"" + val.icon + "\"></div><span class=\"border-right\"></span><div class=\"col text-left forecastFont\"><p class=\"currentCondition\">" + val.shortForecast + "</p><p class=\"currentTemp\">" + val.temperature + " &#8457;</p></div></div></div></div>");
        $(".forecastList").append(forecastCardCode);

        $("#fCard-" + dateName).click(function () {
            if (!($("#forecast-" + dateName).hasClass("show"))) {
                $("#forecast-" + dateName).collapse("show");
                if ($(window).width() < 1365) {
                    //$("#fCard-" + dateName).addClass("forecastCardExpanded");
                    $("html,body").animate({
                        scrollTop: ($("#fCard-" + dateName).offset().top - $("body").css("padding-top").replace("px", "") - 5)
                    });
                }
            } else {
                $("#forecast-" + dateName).collapse("hide");
            }
        });
    });
}

function placeData(wd) {
    //Placing data to their respective elements.
    placeCurrentWeather(wd);
    placeAFD(wd);
    placeWeatherAlerts(wd);
    placeHourlyForecast(wd);
    placeWeeklyForecast(wd);
}

//Database functions
async function runFreshUpdate() {
    //For when then user initiates a hard refresh.

    var settingsStore = localforage.createInstance({
        name: "pwaWeather",
        storeName: "settingsStore"
    });

    settingsStore.getItem("selectedLocation").then(async function (y) {

        console.log("Hard refresh initiated by user...");
        //$("#refreshButton").addClass("nowRefresh");
        await runWeatherData(y.name, y.currentLocation, async function (awd) {
            console.log("Checking the DB for new data...");
            console.log("Placing data...");
            await placeData(awd);
            $(".lastUpdated").text("(Last updated: Just Now)");
            console.log("Done.")
        });
        //$("#refreshButton").removeClass("nowRefresh");
    });
}

async function checkLocalWeatherData(selectedLocation, callback) {
    //Checking to see if the data requested from the local database is outside of the 30 minute range. 

    await localforage.getItem(selectedLocation).then(function (keydata) {
        if (keydata == null) {
            callback("error");
        }
        else {
            console.log(keydata);

            var compareTime = new Date().getTime() - keydata.updateTime;

            console.log(compareTime);
            var timeSince = compareTime / 60000;

            console.log(timeSince);
            if (timeSince <= 30) {
                callback({
                    "old": false,
                    "timeSince": timeSince,
                    "data": keydata
                });
            } else {
                callback({
                    "old": true,
                    "data": keydata
                });
            }
        }
    });
}

async function addWeatherData(isCurrentLocation, weatherData, x) {
    //Adding the gathered data to the locally stored database

    console.log("Adding weather data to DB...");

    var locationName;

    if (isCurrentLocation) {
        locationName = "Current Location";
    }
    else {
        locationName = x;
    }

    await localforage.setItem(locationName, {
        "updateTime": new Date().getTime().toString(),
        "location": weatherData.location,
        "nwsdata": weatherData.nwsdata
    }).then(function (value) {
        console.log(value);
    }).catch(function (err) {
        console.log(err);
    });
}

function checkDBVersion(ver, sStore, callback) {
    //For when the dbVer changes. In this particular instance, there was a database wipe.

    sStore.getItem("dbVersion").then(async function (i) {
        if (i != ver) {
            console.log("DB is outdated.");
            await localforage.clear();
            sStore.setItem("dbVersion", ver);
            console.log("DB has been updated to version " + ver + ".");
        }
        else {
            console.log("DB version is " + i + ". Good to go.")
        }
        callback(true);
    });
}

//Misc. Functions
function shortForecastIcon(condition, daynight) {
    //Converting the icon URL in the NWS data to the WeatherIcons font set.

    //console.log(condition);

    var t;
    /*
    if (daynight) {
        console.log("I'll choose day!");
    }
    else
    {
        console.log("I'll choose night!");
    }
    */

    if (/(tsra)/i.test(condition)) {
        //console.log("Thunderstorms");
        return "wi-thunderstorm";
    } else if (/(few)/i.test(condition)) {
        //console.log("Partly Cloudy");
        if (daynight) {
            return "wi-day-sunny-overcast";
        } else {
            return "wi-night-alt-partly-cloudy";
        }
    } else if (/(bkn)/i.test(condition)) {
        //console.log("Mostly Cloudy");
        if (daynight) {
            return "wi-day-sunny-overcast";
        } else {
            return "wi-night-alt-partly-cloudy";
        }
    } else if (/(sct)/i.test(condition)) {
        //console.log("Partly Cloudy");
        if (daynight) {
            return "wi-day-sunny-overcast";
        } else {
            return "wi-night-alt-partly-cloudy";
        }
    } else if (/(skc)/i.test(condition)) {
        //console.log("Sunny");
        if (daynight) {
            return "wi-day-sunny";
        } else {
            return "wi-night-clear";
        }
    } else if (/(ovc)/i.test(condition)) {
        //console.log("Overcast");
        return "wi-cloud";
    } else if (/(fg)/i.test(condition)) {
        //console.log("Fog");
        if (daynight) {
            return "wi-day-fog";
        } else {
            return "wi-fog";
        }
    } else if (/(shra)/i.test(condition)) {
        //console.log("Rain");
        return "wi-showers";
    } else if (/(rain_showers)/i.test(condition)) {
        //console.log("Rain");
        return "wi-showers";
    } else if (/(hot)/i.test(condition)) {
        //console.log("Rain");
        return "wi-hot";
    } else {
        return "wi-na";
    }


}

function getCurrentLocation(callback) {
    //Standard process of getting the device's current location through the browser.

    if (navigator.geolocation) {
        var lat_lng = navigator.geolocation.getCurrentPosition(function (position) {
            callback(position);
        });
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}

function menuChange(menuItem) {
    if (menuItem == "locationsList") {
        $("#locationsList").collapse("show");
        $("#addLocation").collapse("hide");
    }
    else if (menuItem == "addLocation") {
        $("#locationsList").collapse("toggle");
        $("#addLocation").collapse("toggle");
    }
}

function updateLocationsList() {
    var locationsStore = localforage.createInstance({
        name: "pwaWeather",
        storeName: "locationsStore"
    });

    locationsStore.keys().then(function (kList) {
        var locationList = "";
        $.each(kList, function (key, val) {
            locationList += `<button class="btn mt-2" onclick="selectLocationData('` + val + `');">` + val + `</button><br>`;
        });

        console.log(locationList);
        $("#userList").html(locationList);
    })
}

async function selectLocationData(od, isCurrentLocation) {
    console.log(od);
    await checkLocalWeatherData(od, async function (o) {
        console.log("Placing inital load data...");
        try {
            await placeData(o.data);
            if (o.timeSince < 1) {
                $(".lastUpdated").text("(Last updated: A few moments ago)");
            }
            else {
                $(".lastUpdated").text("(Last updated: " + Math.round(o.timeSince) + " minutes ago)");
            }
        }
        catch {
            console.log("Ignoring initial data due to local data mismatch.");
            console.log("Marking data as old.");
            o.old = true;
        }
        if (o.old == true || o == "error") {
            console.log("Data is either old or doesn't exist. Loading new data...");
            await runWeatherData(od, isCurrentLocation, async function (awd) {
                await placeData(awd);
                $(".lastUpdated").text("(Last updated: Just Now)");
                console.log("Done.")
            });
        }
        else {
            console.log("Checking the DB for last good data...");
            await checkLocalWeatherData(od, async function (ooo) {
                console.log("Placing data...");
                await placeData(ooo.data);
                if (ooo.timeSince < 1) {
                    $(".lastUpdated").text("(Last updated: A few moments ago)");
                }
                else {
                    $(".lastUpdated").text("(Last updated: " + Math.round(o.timeSince) + " minutes ago)");
                }
                console.log("Done.")
            });
        }

        var settingsStore = localforage.createInstance({
            name: "pwaWeather",
            storeName: "settingsStore"
        });

        if (isCurrentLocation) {
            settingsStore.setItem("selectedLocation", {
                "name": "Current Location",
                "currentLocation": true
            });
        }
        else {
            settingsStore.setItem("selectedLocation", {
                "name": od,
                "currentLocation": false
            });
        }

        $("#navbarToggleExternalContent").collapse("hide");
    });


}