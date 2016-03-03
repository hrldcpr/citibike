
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

function getDate(i) {
    return new Date(1000 * (DATA.start + i * DATA.delta));
}

function getIndex(date) {
    return Math.max(0, Math.min(Math.floor((date/1000 - DATA.start) / DATA.delta), DATA.data.length - 1));
}

function radius(docks) {
    return Math.sqrt(docks) / (1 << 21);
}


STATIONS = $.map(DATA.stations, function(id) {
    return STATIONS[id];
});


var width = Math.max(960, window.innerWidth),
    height = Math.max(500, window.innerHeight),
    prefix = prefixMatch(["webkit", "ms", "Moz", "O"]);

var tile = d3.geo.tile()
    .size([width, height]);

var projection = d3.geo.mercator()
    .scale((1 << 22) / 2 / Math.PI)
    .translate([-width / 2, -height / 2]); // just temporary

var tilePath = d3.geo.path()
    .projection(d3.geo.mercator());

var zoom = d3.behavior.zoom()
    .scale(projection.scale() * 2 * Math.PI)
    .scaleExtent([1 << 21, 1 << 24])
// Elizabeth St & Hester St:
    .translate(projection([-73.996375, 40.71729]).map(function(x) { return -x; }))
    .on("zoom", zoomed);

var mercator = d3.geo.mercator().scale(1 / 2 / Math.PI).translate([0,0]);

var colorScale = d3.scale.linear().range(["#3cf", "#037"]);


var margin = {top: 50, right: 20, bottom: 30, left: 50},
    chartWidth = width - 20 - margin.left - margin.right,
    chartHeight = 250 - margin.top - margin.bottom;

var x = d3.time.scale()
    .range([0, chartWidth]);

var y = d3.scale.linear()
    .range([chartHeight, 0]);

var xAxis = d3.svg.axis()
    .scale(x)
    .orient("bottom");

var yAxis = d3.svg.axis()
    .scale(y)
    .orient("left");

var area = d3.svg.area()
    .interpolate("basis")
    .x(function(d) { return x(d.x); })
    .y0(function(d) { return y(d.y0); })
    .y1(function(d) { return y(d.y0 + d.y); });

var stack = d3.layout.stack().values(function(d) { return d.values; });


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

var svg = map.append("svg")
    .attr("class", "chart")
    .attr("width", chartWidth + margin.left + margin.right)
    .attr("height", chartHeight + margin.top + margin.bottom)
    .on("mousemove", chartHover)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
$('.chart').mouseleave(chartLeave);
var chart = svg.append("g"); // so that paths don't go on top of everything else

var svgX = svg.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + chartHeight + ")");

var svgY = svg.append("g")
    .attr("class", "y axis");

var scrubber = svg.append("g")
    .attr("class", "scrubber");
scrubber.append("line")
    .attr("y2", chartHeight);

var info = svg.append("g")
    .attr("class", "info");
var label = info.append("text")
    .attr("class", "name");
var hour = info.append("text")
    .attr("class", "hour")
    .attr("x", chartWidth/2 - 10);
var day = info.append("text")
    .attr("class", "day")
    .attr("x", chartWidth/2 + 10);

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

var hourColorScale = d3.scale.linear().domain([0, 12, 24]).range(["#222", "#aa8", "#222"])
var INDEX = -1;
function setTime(time) {
    scrubber//.transition()
        .attr("transform", "translate(" + x(time) + ",0)");

    var i = getIndex(time);
    if (INDEX == i) return;
    INDEX = i;
    updateInfo();

    //layer.selectAll(".tile").style("background", hourColorScale(time.getHours()));

    overlay.selectAll(".station").data(DATA.data[i])
        .call(function(station) {
            station.enter()
                .append("g").attr("class", "station")
                .attr("transform", function(d, i) { return "translate(" + mercator([STATIONS[i].longitude, STATIONS[i].latitude]) + ")"; })
                .on("mouseover", stationOver)
                .call(function(enter) {
                    enter.append("title")
                        .text(function(d, i) { return STATIONS[i].label; })
                    enter.append("circle").attr("class", "docks");
                    enter.append("circle").attr("class", "bikes");
                    enter.append("circle").attr("class", "pulse");
                });
            $('.station').mouseleave(stationLeave);

            station.select(".bikes")
                .attr("r", function(d) { return radius(d[0]); })
                .attr("fill", function(d) { return colorScale(d[0] / (d[0] + d[1])); });
            station.select(".docks")
                .attr("r", function(d) { return radius(d[0] + d[1]); });
        });
}

x.domain([getDate(0), getDate(DATA.data.length)]);
svgX.call(xAxis);

var STATION = -1;
function setStation(i) {
    if (STATION == i) return;
    STATION = i;
    updateInfo();

    var getBikes, getDocks;
    if (i in STATIONS) {
        getBikes = function(d) { return d[i][0]; };
        getDocks = function(d) { return d[i][1]; };
    } else { // system-wide totals
        getBikes = function(d) { return d3.sum(d, function(x) { return x[0]; }) };
        getDocks = function(d) { return d3.sum(d, function(x) { return x[1]; }) };
    }

    var data = stack([
        {className: "bikes", values: $.map(DATA.data, function(d, i) { return {x: getDate(i), y: getBikes(d)} })},
        {className: "docks", values: $.map(DATA.data, function(d, i) { return {x: getDate(i), y: getDocks(d)} })}
    ]);

    y.domain([0, d3.max(data[1].values, function(d) { return d.y0 + d.y; })]);
    svgY.transition().call(yAxis);

    chart.selectAll("path").data(data)
        .call(function(path) {
            path.enter()
                .append("path")
                .attr("class", function(d) { return d.className; });

            path.transition().attr("d", function(d) { return area(d.values) });
        });
}

var hourFormat = d3.time.format("%_I%p");
var dayFormat = d3.time.format("%A");
function updateInfo() {
    label.text(STATION in STATIONS ? STATIONS[STATION].label : "All Stations");
    var date = getDate(INDEX);
    hour.text(hourFormat(date).toLowerCase());
    day.text(dayFormat(date));
}

var CHART_HOVER = false;
function chartHover() {
    CHART_HOVER = true;
    setTime(x.invert(d3.mouse(this)[0] - margin.left));
}
function chartLeave() {
    CHART_HOVER = false;
}

function stationOver(d, i) {
    setStation(i);
}
function stationLeave() {
    setStation();
}

function lapse() {
    if (!CHART_HOVER) {
        setTime(getDate(INDEX + 1));
        if (INDEX >= DATA.data.length - 1) INDEX = 0; // wrap around
    }
    setTimeout(lapse, 100);
}

zoomed();
setStation();
lapse();
