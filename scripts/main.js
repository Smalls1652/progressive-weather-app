var geoLoc = {};

var apiCalls = [];

function shortForecastIcon(condition, daynight) {
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
    } else {
        return "wi-na";
    }


}

function getCurrentLocation(callback) {

    if (navigator.geolocation) {
        var lat_lng = navigator.geolocation.getCurrentPosition(function (position) {
            callback(position);
        });
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}

async function locationSuccess(callback) {

    await getCurrentLocation(async function (point) {
        var allWeatherData = {};

        console.log("Coordinates saved.");
        allWeatherData = {
            "location": {
                "latitude": point.coords.latitude,
                "longitude": point.coords.longitude
            }
        };

        console.log("Starting weather data gather...");

        await getPointData(allWeatherData.location, async function (nwsbegin) {
            allWeatherData.nwsdata = {
                "afd": {},
                "alerts": {},
                "station": {},
                "current": {},
                "hrs": {},
                "forecast": {},
                "point": {}
            };

            allWeatherData.nwsdata.point = nwsbegin;

            console.log("Grabbing point data from NWS...");
            console.log(nwsbegin);
            await getWeatherStation(nwsbegin, async function (wthrstatn) {
                allWeatherData.nwsdata.station = wthrstatn;

                await getCurrentWeather(nwsbegin, async function (curweather) {
                    allWeatherData.nwsdata.current = curweather;

                    await getAlertsData(nwsbegin, async function (alert) {
                        console.log("Gathing alerts in the area from NWS...");
                        allWeatherData.nwsdata.alerts = alert;

                        await getAFDList(nwsbegin, async function (afd) {

                            console.log("Getting the most recent AFD text from the local NWS office...");

                            await getAFDText(afd['@graph'][0].id, async function (afdtext) {
                                allWeatherData.nwsdata.afd = {
                                    "issuedTime": afdtext.issuanceTime,
                                    "productText": afdtext.productText.replace(/\\n/g, "<br />")
                                };

                                await getHourlyForecast(nwsbegin, async function (hrly) {
                                    console.log("Getting current weather and hourly forecast data from NWS...");
                                    var returnHourly = [];
                                    $.each(hrly.properties.periods.slice(0, 13), async function (key, val) {
                                        returnHourly.push({
                                            "hour": val.startTime,
                                            "temp": val.temperature,
                                            "icon": val.icon,
                                            "condition": val.shortForecast,
                                            "isDayTime": val.isDaytime
                                        });
                                    });

                                    allWeatherData.nwsdata.hrs = returnHourly;
                                    await getNextFiveDays(nwsbegin, async function (weekataglance) {
                                        console.log("Getting the next five days from NWS...");
                                        var returnData = [];
                                        $.each(weekataglance.properties.periods, async function (key, val) {
                                            returnData.push({
                                                "dayName": val.name,
                                                "isDaytime": val.isDaytime,
                                                "icon": val.icon,
                                                "temp": val.temperature,
                                                "detailedForecast": val.detailedForecast,
                                                "shortForecast": val.shortForecast
                                            });
                                        });
                                        allWeatherData.nwsdata.forecast = returnData;
                                        await addWeatherData(allWeatherData);
                                        callback(allWeatherData);
                                    });
                                });
                            });
                        });
                    });
                });
            })
        });
    });

    /*
    console.log(allWeatherData.location);
    dataGet(position);
    var currentWeather = getCurrentWeather(allWeatherData.location);
    console.log(currentWeather);
    var forecastGet = getPointData(allWeatherData.location);
    console.log(forecastGet);
    var forecastObj = getNextFiveDays(forecastGet);
    console.log(forecastObj);

    */
}

function locationError() {

    alert("Location request failure. Please try again.");
    console.log("Location request failure.");
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

    $.getJSON(apiCall.stations, async function (data) {
        $.getJSON(data.features[0].id + "/observations/current", await function (d2) {
            callback(d2);
        });
    });

}

async function getAFDList(apiCall, callback) {

    console.log(apiCall.office);
    $.getJSON("https://api.weather.gov/products/types/AFD/locations/" + apiCall.office, await function (data) {
        console.log(data);
        callback(data);

    });

}

async function getAlertsData(apiCall, callback) {

    $.getJSON(apiCall.county, async function (data) {

        $.getJSON("https://api.weather.gov/alerts/active/zone/" + data.properties.id, await function (aldt) {
            callback(aldt);
        });

    });

}

async function getAFDText(apiCall, callback) {

    $.getJSON("https://api.weather.gov/products/" + apiCall, await function (data) {

        callback(data);

    });

}

async function getHourlyForecast(apiCall, callback) {

    $.getJSON(apiCall.hrfore, await function (data) {

        callback(data);

    });

}

async function getNextFiveDays(apiCall, callback) {

    $.getJSON(apiCall.forecast, await function (data) {

        callback(data);

    });

}

async function addWeatherData(weatherData) {
    console.log("Adding weather data to DB...");
    await localforage.setItem(new Date().getTime().toString(), {
        "location": weatherData.location,
        "nwsdata": weatherData.nwsdata
    }).then(async function (value) {
        console.log(value);
    }).catch(async function (err) {
        console.log(err);
    });
}

async function checkLocalWeatherData(callback) {
    await localforage.length().then(async function (numofkeys) {
        await localforage.key(numofkeys - 1).then(async function (keyname) {
            console.log(keyname);

            var compareTime = new Date().getTime() - keyname;

            console.log(compareTime);
            var timeSince = compareTime / 60000;

            console.log(timeSince);
            if (timeSince <= 30) {
                callback({
                    "old": false,
                    "timeSince": timeSince
                });
            } else {
                callback({
                    "old": true,
                });
            }
        });
    });
}

async function getLastSavedWeatherData(callback) {
    await localforage.length().then(async function (numofkeys) {
        await localforage.key(numofkeys - 1).then(async function (keyname) {
            localforage.getItem(keyname).then(await function (value) {
                callback(value);
            });
        });
    });

}

async function placeData(wd) {

    $("#weatherIcon").html("<i class=\"currentConditionIcon current-cond-icon wi " + shortForecastIcon(wd.nwsdata.current.properties.icon, true) + "\"></i>");
    $(".weatherStation").text("From " + ((wd.nwsdata.station.name).split(", ")[1]) + " [" + wd.nwsdata.station.stationIdentifier + "]");
    $(".currentCondition").text(wd.nwsdata.current.properties.textCondition);
    $("#WhereAmI").text(wd.nwsdata.point.properties.relativeLocation.properties.city + ", " + wd.nwsdata.point.properties.relativeLocation.properties.state);
    $(".currentTemp").html((Math.round(wd.nwsdata.current.properties.temperature.value * 1.8 + 32)) + " &#8457;");

    var curCondTbl = `
    <table class="table table-sm table-borderless">
    <tbody>
        <tr>
        <th scope="row" class="text-left">Wind</th>
        <td class="text-left">` + Math.round(wd.nwsdata.current.properties.windSpeed.value) + ` MPH</td>
        </tr>
        <tr>
        <th scope="row" class="text-left">Humidity</th>
        <td class="text-left">` + Math.round(wd.nwsdata.current.properties.relativeHumidity.value) + `%</td>
        </tr>
        <th scope="row" class="text-left">Pressure</th>
        <td class="text-left">` + Math.round((wd.nwsdata.current.properties.barometricPressure.value * 0.01)) + ` mb (` + Math.round((wd.nwsdata.current.properties.barometricPressure.value * 0.00029529983071)) + ` in)</td>
        </tr>
        </tbody>
    </table>`;

    $("#curCondTbl").html(curCondTbl);

    $("#afdText").html(wd.nwsdata.afd.productText);

    $("#weatherAlerts").html(null);

    if (wd.nwsdata.alerts.features) {
        $.each(wd.nwsdata.alerts.features, async function (key, val) {
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

    var hourlyHours = "";
    var hourlyIcons = "";
    var hourlyTemps = "";
    var hourlyPct = "";
    var hourlyConditions = "";

    $.each(wd.nwsdata.hrs.slice(1, 13), async function (key, val) {
        var h = new Date(val.hour).getHours();
        var ampm = h >= 12 ? 'PM' : 'AM';

        h = h % 12;
        h = h ? h : 12;

        var regexURL = (/^https:\/\/api\.weather\.gov\/icons\/.*?\/(?:day|night)\/(.*?)$/).exec(val.icon);
        console.log(regexURL);
        var regexIcons = (/(?:(?<condition1>.*)\/(?<condition2>.*?)|(?<condition>.*))(?=\?size=.*)/).exec(regexURL[1]);

        console.log(val.icon);
        console.log(regexIcons);
        var pctChance;

        if (regexIcons.groups['condition1'] && regexIcons.groups['condition2']) {
            console.log("Two conditions");
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
            console.log(regexIcons.groups['condition']);
            console.log("One condition");
            var ptc = regexIcons.groups['condition'];
            console.log(ptc);
            if ((/^(?:.*?,)(?<chance>.*)$/).test(ptc)) {
                console.log("Chance found.");
                pctChance = (/^(?:.*?,)(?<chance>.*)$/).exec(ptc)[1] + "%";

            }
            else {
                console.log("Chance not found.");
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

    $(".forecastList").html(null);

    $.each(wd.nwsdata.forecast, async function (key, val) {
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

function startupScript() {

    getCurrentLocation();

}

async function runFreshUpdate() {

    console.log("Hard refresh iniated by user...");
    //$("#refreshButton").addClass("nowRefresh");
    await locationSuccess(async function (awd) {
        console.log("Checking the DB for new data...");
        await getLastSavedWeatherData(async function (data) {
            console.log("Placing data...");
            await placeData(data);
            $(".lastUpdated").text("(Last updated: Just Now)");
            console.log("Done.")
        });
    });
    //$("#refreshButton").removeClass("nowRefresh");
}

function dataGet(location) {
    console.log(location);
}