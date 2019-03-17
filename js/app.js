String.prototype.format = function () {
  var formatted = this;
  for (var i = 0; i < arguments.length; i++) {
    formatted = formatted.replace(
      RegExp('\\{' + i + '\\}', 'g'), arguments[i]);
  }
  return formatted;
};

var countries;
var base;

var container = d3.select(".container");

var mapElement = d3.select("#map")
  .style("height",  calculateHeight() + "px" );

var mapWidth = parseInt(mapElement.style('width'));

var margin = {top: 10, right: 75, bottom: 10, left: 150},
  width = mapWidth,
  width = width - margin.left - margin.right,
  mapRatio = 1.5,
  height = width * mapRatio - margin.top - margin.bottom;

if(height < 500) {
  margin.left = 75;
  margin.right = 40;
  width = mapWidth - margin.left - margin.right;
  height = 650;
}

function fetchJSONFile(path, callback) {
  var httpRequest = new XMLHttpRequest();
  httpRequest.onreadystatechange = function() {
    if (httpRequest.readyState === 4) {
      if (httpRequest.status === 200 || httpRequest.status === 0) {
        var data = JSON.parse(httpRequest.responseText);
        if (callback) callback(data);
      }
    }
  };
  httpRequest.open('GET', path);
  httpRequest.send();
}

// fetchJSONFile('/api/', formatData);
fetchJSONFile('data/countries.json', formatData);

function formatData(data){
  countries = data;

  base = _.find(countries, {'rel': 'us'});

  countries = _.chain(countries)
    .unique("rel")
    .reverse()
    .map(function(country){
      country.title = country.title.replace(/ \([^)]*\)/, '');

      var difference = 100 - base.convertedPrice / country.convertedPrice * 100;
      country.priceDifference = difference;
      country.formattedPriceDifference = (Math.round(difference * 100) / 100).toFixed(2);
      country.formattedConvertedPrice = (Math.round(country.convertedPrice * 100) / 100).toFixed(2);

      country.class = country.priceDifference < 0 ? "bar negative" : "bar positive";
      country.class = "{0} {1} {2}".format(country.class, country.region.toLowerCase(), country.countryCode.toLowerCase());

      return country;
    })
    .value();

  drawMap();
  drawBarChart();
  drawScatterPlot();
}

function drawMap(){
  var baseColor = "rgba(133, 187, 35, 1)";
  var ratio = 20;
  var fills = {
    LOWEST: tinycolor.lighten(baseColor, ratio).toHexString(),
    LOW: tinycolor.lighten(baseColor, ratio/2).toHexString(),
    AVERAGE: tinycolor(baseColor).toHexString(),
    HIGH: tinycolor.darken(baseColor, ratio/2).toHexString(),
    HIGHEST: tinycolor.darken(baseColor, ratio).toHexString(),
    defaultFill: 'rgba(255, 255, 255, .1)'
  };

  var map = new Datamap({
    element: document.getElementById('map'),
    fills: fills,
    projection: 'equirectangular', //"mercator"/"equirectangular"
    done: updateMapColors,
    disableDefaultStyles: true,
    geographyConfig: {
      hideAntarctica: true,
      borderWidth: 0,
      popupTemplate: function(geography, data) {
        if(!data)
          return;

        return '<div class="hoverinfo"><strong>{0}:</strong> ${1}<br>Local price: {2} {3}</div>'.format(data.internationalName, data.convertedPrice, data.currency, data.price);
      },
      popupOnHover: true,
      highlightOnHover: true,
      highlightFillColor: function(geography, data){
        if(!data)
          return fills.defaultFill;

        return 'rgba(255, 255, 255, .9)';
      },
      highlightBorderWidth: 0
    }
  });

  map.legend();
}
function updateMapColors(map){
  var sortedDifferences = _.map(_.sortBy(countries, 'priceDifference'), 'priceDifference');
  var quantile = [
    d3.quantile(sortedDifferences, 0.2),
    d3.quantile(sortedDifferences, 0.4),
    d3.quantile(sortedDifferences, 0.6),
    d3.quantile(sortedDifferences, 0.8)
  ];
  var update = {};
  _.each(countries, function(country){
    update[country.countryCode] = {
      fillKey: calculateColor(country.priceDifference),
      internationalName: country.internationalName,
      priceDifference: country.formattedPriceDifference,
      convertedPrice: country.formattedConvertedPrice,
      price: country.price,
      currency: country.currency,
      region: country.region
    };
  });
  setTimeout(function(){
    map.updateChoropleth(update);
  }, 100);

  function calculateColor(diff){
    var color;
    if(diff <= quantile[0])
      color = 'LOWEST';

    if(diff > quantile[0])
      color = 'LOW';

    if(diff > quantile[1] && diff < quantile[2])
      color = 'AVERAGE';

    if(diff > quantile[2])
      color = 'HIGH';

    if(diff >= quantile[3])
      color = 'HIGHEST';

    return color;
  }
}

function drawBarChart(){
  var container = d3.select("#bar-chart");
  var outerWidth = width + margin.left + margin.right;

  var x = d3.scale.linear()
    .range([margin.left, width + margin.left])

  var y = d3.scale.ordinal()
    .rangeRoundBands([0, height], .3);

  var xAxis = d3.svg.axis()
    .scale(x)
    .orient("bottom")
    .tickFormat(function(d){ return d + "%" })
    .tickSize(height);

  container.append("p")
    .html("Local currency under/over valuation against the dollar, %");

  var svg = container.append("svg")
    .attr("aria-labelledby", "bar-chart-title")
    .attr("width", outerWidth)
    .attr("height", height + margin.top + margin.bottom);

  x.domain(d3.extent(countries, function(d) { return d.priceDifference; })).nice();
  y.domain(countries.map(function(d) { return d.internationalName; }));

  svg.append("title")
    .attr("id", "bar-chart-title")
    .text("Bar chart with negative values of the converted price index");

  svg.append("g")
    .attr("class", "x axis")
    .call(xAxis)

  svg.append("g")
    .attr("class", "y axis")
    .append("line")
    .attr("x1", x(0))
    .attr("x2", x(0))
    .attr("y2", height);

  var bars = svg.selectAll("g.bar")
    .data(countries)
    .enter()
    .append("g")
    .attr("class", function(d) { return d.class; });

  bars.append("rect")
    .attr("x", function(d) { return x(Math.min(0, d.priceDifference)); })
    .attr("y", function(d) { return y(d.internationalName); })
    .attr("width", function(d) { return Math.abs(x(d.priceDifference) - x(0)); })
    .attr("height", y.rangeBand());

  var labels = bars.append("svg:text")
    .attr("class", "label")
    .attr("x", 0)
    .attr("y", function(d) { return y(d.internationalName); })
    .attr("text-anchor", "left")
    .text(function(d) { return d.internationalName; });

  var nil = svg.selectAll("g.bar.{0}".format(base.countryCode.toLowerCase()))
    .append("svg:text")
    .attr("class", "nil")
    .attr("x", x(0))
    .attr("y", y(base.internationalName))
    .text("nil");

  var prices = bars.append("svg:text")
    .attr("class", "price")
    .attr("x", outerWidth)
    .attr("y", function(d) { return y(d.internationalName); })
    .text(function(d) {
      return d.formattedConvertedPrice;
    });

  var priceDefinition = svg.append("svg:text")
    .attr("class", "price-definition visible-md visible-lg")
    .attr("x", outerWidth)
    .attr("y", height)
    .attr("text-anchor", "left")
    .text("Spotify Premium price, $");

  container.append("small")
    .text("Source: US Dollar market exchange rate, May 2014");

  labels.attr("transform", function(d) { return "translate(0, {0})".format(getYPosition(labels)); });
  nil.attr("transform", function(d) { return "translate(2, {0})".format(getYPosition(nil)); });
  prices.attr("transform", function(d) { return "translate(0, {0})".format(getYPosition(prices)); });
  priceDefinition.attr("transform", function(d) { return "translate(-{0}, -{1})".format((getBoundaryWidth(priceDefinition) + margin.right/2), (getBoundaryHeight(priceDefinition) - 2)); });

  function getBoundaryHeight(elements){
    return elements.node().getBBox().height;
  }
  function getBoundaryWidth(elements){
    return elements.node().getBBox().width;
  }
  function getYPosition(elements){
    return y.rangeBand() / 2 + getBoundaryHeight(elements) / 4;
  }
};

function calculateHeight(){
  return 270 / 649 * window.innerWidth;
}
function calculateWidth(){
  return 649 / 270 * window.innerHeight;
}


d3.selectAll(".continent-chooser h3")
  .on('click', filterContinents);

function filterContinents(d, id) {
  // Remove .active from currently selected continent
  d3.selectAll(".continent-chooser h3.active")
    .classed("active", false);

  // Set .active for clicked continent
  var element = d3.select(this)
    .classed("active", true);

  var charts = [
    "#bar-chart svg",
    "#scatter-plot svg",
    "#map svg"
  ];
  _.each(charts, function(item) {
    var chart = d3.select(item);

    if(id === 0)
      return chart.attr("class", "");

    chart.attr("class", "filter {0}".format(element.text().toLowerCase()));
  });
}

// Horrible way to handle resizing of the viewport, but it kind of works
var resizing = false;
d3.select(window).on('resize', function(){
  if(resizing !== false)
      clearTimeout(resizing);
  resizing = setTimeout(redrawCharts, 100);
});

function redrawCharts(){
  var mapWidth = parseInt(mapElement.style('width'));

  margin = {top: 10, right: 75, bottom: 10, left: 150};
  width = mapWidth;
  width = width - margin.left - margin.right;
  height = width * mapRatio - margin.top - margin.bottom;

  if(height < 500) {
    margin.left = 75;
    margin.right = 40;
    width = mapWidth - margin.left - margin.right;
    height = 650;
  }

  d3.select('#map svg').remove();
  d3.select('#map div').remove();
  mapElement.style("height",  calculateHeight() + "px" );
  drawMap();

  d3.select('#bar-chart p').remove();
  d3.select('#bar-chart small').remove();
  d3.select('#bar-chart svg').remove();
  drawBarChart();

  if(width > 400){
    d3.select('#scatter-plot svg').remove();
    d3.select('#scatter-plot small').remove();
    d3.select('#scatter-plot div').remove();
    drawScatterPlot();
  }
};