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
var last_updated;

var container = d3.select(".container");

var mapElement = d3.select("#map")
  .style("height",  calculateHeight() + "px" );

var mapWidth = parseInt(mapElement.style('width'));

if (mapWidth < 750) {
  var mapRatio = 15;
} else {
  var mapRatio = 2.7;
};

var margin = {top: 10, right: 75, bottom: 10, left: 150},
  width = mapWidth,
  width = width - margin.left - margin.right,
  height = width * mapRatio - margin.top - margin.bottom;

if(height < 500) {
  margin.left = 75;
  margin.right = 40;
  width = mapWidth - margin.left - margin.right;
  height = 650;
}

function fetchJSONFile(path, callback) {
  var httpRequest = new XMLHttpRequest();

  var problems_block = document.getElementById('problems');
  var content_block = document.getElementById('content');
  
  httpRequest.onreadystatechange = function () {
    if (httpRequest.readyState === 4) {
      if (httpRequest.status === 200 || httpRequest.status === 0) {
        try {
          var data = JSON.parse(httpRequest.responseText);
          last_updated = httpRequest.getResponseHeader('last-modified');
          last_updated = new Date(last_updated).toLocaleString('en-us', {year:"numeric", month:"short", day:"numeric"}) 
        } catch (e) {
          content_block.style.display = 'none';
          problems_block.style.display = 'block';
        }
        if (callback) callback(data);
      }
    }
  };
  httpRequest.open('GET', path);
  httpRequest.send();
}

fetchJSONFile('data/summary.json', formatData);

function formatData(data){
  
  countries = data;

  var sortByProperty = function (property) {
    return function (x, y) {
        return ((x[property] === y[property]) ? 0 : ((x[property] > y[property]) ? 1 : -1));
    };
  };

  countries.sort(sortByProperty('convertedPrice')); // sort bars by convertedPrice

  base = _.find(countries, {'rel': 'US'});

  countries = _.chain(countries)
    .unique("rel")
    .reverse()
    .map(function(country){
      country.title = country.title.replace(/ \([^)]*\)/, '');

      var difference = 100 - base.convertedPrice / country.convertedPrice * 100;
      country.priceDifference = difference;
      country.formattedPriceDifference = (Math.round(difference * 100) / 100).toFixed(2);
      country.formattedConvertedPrice = (Math.round(country.convertedPrice * 100) / 100).toFixed(2);

      if (country.restoredPrice == 1){
        country.restoredPrice = '*';
      }
      else {
        country.restoredPrice = '';
      };

      country.class = country.priceDifference < 0 ? "bar negative" : "bar positive";
      country.class = "{0} {1} {2}".format(country.class, country.region.toLowerCase(), country.countryCode.toLowerCase());

      return country;
    })
    .value();

  drawMap();
  drawBarChart();
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

        return '<div class="hoverinfo"><strong>{0}:</strong> $&nbsp;{1}<br>Local price: {2}&nbsp;{3}</div>'.format(data.title, data.convertedPrice, data.currency, data.price);
      },
      popupOnHover: true,
      highlightOnHover: true,
      highlightFillColor: function(geography, data){
        if(!data)
          return fills.defaultFill;

        return 'orange';
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
      title: country.title,
      priceDifference: country.formattedPriceDifference,
      convertedPrice: country.formattedConvertedPrice,
      price: country.price,
      f_price: country.f_price,
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
    .attr("height", height + margin.top + margin.bottom + 15);

  x.domain(d3.extent(countries, function(d) { return d.priceDifference; })).nice();
  y.domain(countries.map(function(d) { return d.title; }));

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
    .attr("y", function(d) { return y(d.title); })
    .attr("width", function(d) { return Math.abs(x(d.priceDifference) - x(0)); })
    .attr("height", y.rangeBand());

  var labels = bars.append("svg:text")
    .attr("class", "label")
    .attr("x", 0)
    .attr("y", function(d) { return y(d.title); })
    .attr("text-anchor", "left")
    .text(function(d) { return d.title; });

  var nil = svg.selectAll("g.bar.{0}".format(base.countryCode.toLowerCase()))
    .append("svg:text")
    .attr("class", "nil")
    .attr("x", x(0))
    .attr("y", y(base.title));

  var prices = bars.append("svg:text")
    .attr("class", "price")
    .attr("x", outerWidth)
    .attr("y", function(d) { return y(d.title); })
    .text(function(d) {
      return d.formattedConvertedPrice + d.restoredPrice;
    });

  var priceDefinition = svg.append("svg:text")
    .attr("class", "price-definition visible-md visible-lg")
    .attr("x", outerWidth)
    .attr("y", height)
    .attr("text-anchor", "left")
    .text("Spotify Premium price, $");

  container.append("small")
    .html("Source: OpenExchangeRates<br>Exchange rates updates every monday at 09:00 (UTC+3)<br>Last update: " + last_updated +
    "<br><br>* - Unable to update price from Spotify, so last known was used. The dollar-converted price has been updated based on it.");

  labels.attr("transform", function(d) { return "translate(0, {0})".format(getYPosition(labels)); });
  nil.attr("transform", function(d) { return "translate(2, {0})".format(getYPosition(nil)); });
  prices.attr("transform", function(d) { return "translate(0, {0})".format(getYPosition(prices)); });
  priceDefinition.attr("transform", function(d) { return "translate(-170, 30)".format((getBoundaryWidth(priceDefinition) + margin.right/2), (getBoundaryHeight(priceDefinition) - 2)); });

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
  var content_width = document.getElementById('content').clientWidth;
  return 270 / 649 * (content_width * 1.25);
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
};