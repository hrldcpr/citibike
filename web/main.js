
var width = Math.max(960, window.innerWidth),
height = Math.max(500, window.innerHeight),
prefix = prefixMatch(["webkit", "ms", "Moz", "O"]);

var tile = d3.geo.tile()
    .size([width, height]);

var projection = d3.geo.mercator()
    .scale((1 << 22) / 2 / Math.PI)
    .translate([-width / 2, -height / 2]); // just temporary

var tileProjection = d3.geo.mercator();

var tilePath = d3.geo.path()
    .projection(tileProjection);

var zoom = d3.behavior.zoom()
    .scale(projection.scale() * 2 * Math.PI)
    .scaleExtent([1 << 21, 1 << 23])
// Elizabeth St & Hester St:
    .translate(projection([-73.996375, 40.71729]).map(function(x) { return -x; }))
    .on("zoom", zoomed);

var map = d3.select("body").append("div")
    .attr("class", "map")
    .style("width", width + "px")
    .style("height", height + "px")
    .call(zoom);

var layer = map.append("div")
    .attr("class", "layer");

var overlay = map.append("svg")
    .attr("class", "overlay")
    .append("g");

var info = map.append("div")
    .attr("class", "info");


function radius(docks) {
    return Math.sqrt(docks) / (1 << 21);
}

function click() {
    updateDeparture(d3.select(this));
}

function enterStation(enter) {
    enter = enter.append("g").attr("class", "station")
        .attr("transform", function(d) { return "translate(" + mercator([d.longitude, d.latitude]) + ")"; })
        .on("click", click);
    enter.append("title")
        .text(function(d) { return d.id; })
    enter.append("circle").attr("class", "docks")
        .attr("r", 0)
        .transition()
        .attr("r", function(d) { return radius(d.availableBikes + d.availableDocks); });
    enter.append("circle").attr("class", "bikes")
        .attr("r", 0)
        .transition()
        .attr("r", function(d) { return radius(d.availableBikes); });
    enter.append("circle").attr("class", "pulse");
}

function updateArrival(update) {
    var transition = update.transition()
        .delay(function() { return 10000 * Math.random(); })
        .duration(1000);
    transition.selectAll(".pulse")
        .each("start", function() {
            d3.select(this)
                .attr("r", radius(500))
                .attr("opacity", 0);
        })
        .attr("r", function(d) { return radius(d.availableBikes); })
        .attr("opacity", 1);

    transition = transition.transition().duration(250);
    transition.selectAll(".bikes")
        .attr("r", function(d) { return radius(1.5 * (d.availableBikes + d.availableDocks)); })
        .transition()
        .attr("r", function(d) { return radius(d.availableBikes); });
    transition.selectAll(".docks")
        .attr("r", function(d) { return radius(d.availableBikes + d.availableDocks); });
}

function updateDeparture(update) {
    var transition = update.transition()
        .delay(function() { return 10000 * Math.random(); })
        .duration(1000);
    transition.selectAll(".pulse")
        .each("start", function(d) {
            d3.select(this)
                .attr("r", radius(d.availableBikes))
                .attr("opacity", 1);
        })
        .attr("r", radius(500))
        .attr("opacity", 0);

    transition = transition.transition().duration(250);
    transition.selectAll(".docks")
        .attr("r", function(d) { return radius(1.5 * (d.availableBikes + d.availableDocks)); })
        .transition()
        .attr("r", function(d) { return radius(d.availableBikes + d.availableDocks); });
    transition.selectAll(".bikes")
        .attr("r", function(d) { return radius(d.availableBikes); });
}

var stations;
var histories;
var mercator = d3.geo.mercator().scale(1 / 2 / Math.PI).translate([0,0]);
(function update() {
    // only load "updates" (which is actually all counts) if we have already loaded stations:
    $.get("http://appservices.citibikenyc.com/data2/stations.php?updateOnly=" + !!stations, function(data) {
        data = data.results;
        var station = overlay.selectAll(".station");

        if (!stations) { // initial load of all data
            stations = {}; histories = {};
            $.each(data, function(_, d) {
                stations[d.id] = d; histories[d.id] = [];
            });
            enterStation(station.data(data, function(d) { return d.id; }).enter());
        }

        else { // we only loaded the counts, so incorporate them into full data and only use the changes
            var arrivals = [];
            var departures = [];
            var arrived = 0, departed = 0, bikes = 0, docks = 0;
            $.each(data, function(_, d) {
                var station = stations[d.id];
                bikes += d.availableBikes; docks += d.availableDocks;
                if (d.availableBikes != station.availableBikes) {
                    var history = histories[d.id];
                    var d0 = history.length >= 2 ? history[history.length - 2] : station;

                    if (d.availableBikes > d0.availableBikes)
                    { arrivals.push(station); arrived += d.availableBikes - station.availableBikes; }
                    else if (d.availableBikes < d0.availableBikes)
                    { departures.push(station); departed += d.availableBikes - station.availableBikes; }

                    station.availableBikes = d.availableBikes;
                    station.availableDocks = d.availableDocks;
                    history.push(d);
                }
            });
            console.log({arrivals: arrivals.length, departures: departures.length, arrived: arrived, departed: departed, bikes: bikes, docks: docks});

            updateArrival(station.data(arrivals, function(d) { return d.id; }));
            updateDeparture(station.data(departures, function(d) { return d.id; }));
        }

        d3.timer(update, 1000);
    }, 'jsonp');

    return true; // lest d3.timer repeat ad nauseum
})();

zoomed();

function zoomed() {
    var tiles = tile
        .scale(zoom.scale())
        .translate(zoom.translate())
    ();

    overlay.attr("transform", svgTransform(zoom.scale(), zoom.translate()));

    var image = layer
        .style(prefix + "transform", matrix3d(tiles.scale, tiles.translate))
        .selectAll(".tile")
        .data(tiles, function(d) { return d; });

    image.exit()
        .each(function(d) { this._xhr.abort(); })
        .remove();

    image.enter().append("svg")
        .attr("class", "tile")
        .style("left", function(d) { return d[0] * 256 + "px"; })
        .style("top", function(d) { return d[1] * 256 + "px"; })
        .each(function(d) {
            var svg = d3.select(this);
            this._xhr = d3.json("http://" + ["a", "b", "c"][(d[0] * 31 + d[1]) % 3] + ".tile.openstreetmap.us/vectiles-highroad/" + d[2] + "/" + d[0] + "/" + d[1] + ".json", function(error, json) {
                var k = Math.pow(2, d[2]) * 256; // size of the world in pixels

                tilePath.projection()
                    .translate([k / 2 - d[0] * 256, k / 2 - d[1] * 256]) // [0°,0°] in pixels
                    .scale(k / 2 / Math.PI);

                svg.selectAll("path")
                    .data(json.features.sort(function(a, b) { return a.properties.sort_key - b.properties.sort_key; }))
                    .enter().append("path")
                    .attr("class", function(d) { return d.properties.kind; })
                    .attr("d", tilePath);
            });
        });
}

function matrix3d(scale, translate) {
    var k = scale / 256, r = scale % 1 ? Number : Math.round;
    return "matrix3d(" + [k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0, r(translate[0] * scale), r(translate[1] * scale), 0, 1 ] + ")";
}

function svgTransform(scale, translate) {
    return "translate(" + translate + ") scale(" + scale + ")";
}

function prefixMatch(p) {
    var i = -1, n = p.length, s = document.body.style;
    while (++i < n) if (p[i] + "Transform" in s) return "-" + p[i].toLowerCase() + "-";
    return "";
}
