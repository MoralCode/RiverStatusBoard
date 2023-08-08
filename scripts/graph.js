//	
//		TRRA Dashboard
//		by Maxwell Garber <max.garber+dev@gmail.com>
//		graph.js
//


//	Global Variables
var abscissa = { observed: [], forecast: [] };
var moments = { observed: [], forecast: [] };
var ordinates = {
	observed: { flow: [], flood: [], temp: [] },
	forecast: { flow: [], flood: [], temp: [] }
};
var units = { flow: 'kcfs', flood: 'ft', temp: '˚C' };
var xAxis = {};
var yAxis_flow = {};
var yAxis_flood = {};
var yAxis_temp = {};
var graphScale = {};
var flowDataset = {};
var floodDataset = {};
var tempDataset = {};
var graphData = {};
var graphScale = {};
var graphOptions = {};
var graphCanvas = null;
var graphSettings = {};
var theGraph;

let plotColors = {
	flow: '#0088ff',
	flood: '#00ff00',
	temperature: '#ff0000'
};

let selectors = {
	graphCanvas: '#graphCanvas'
};

let floodSourceURI = "https://water.weather.gov/ahps2/hydrograph_to_xml.php?gage=blbn6&output=xml&time_zone=edt";//CHAMGEME
let floodParameters = {
	gage: 'blbn6',//CHANGEME
	output: 'xml'
};

let temperatureSourceURI = "https://waterservices.usgs.gov/nwis/iv/";
let temperatureParameters = {
	format: 'waterml,2.0',
	sites: '04231600',//TODO: changeme
	startDT: '',		// literal example '2017-04-12T15:00-0000'	@NOTE these get overwritten in flow/flood callback
	endDT: '',			// literal example '2017-04-14T01:30-0000'
	parameterCd: '00010',
	siteStatus: 'all'
};


let flowSourceURI = 'https://waterservices.usgs.gov/nwis/iv';
let flowParameters = {
	format: 'json',			// 'waterml,2.0' is old style
	sites: '04230650',//'04230650',//TODO, changeme
	parameterCd: '00060',
	siteStatus: 'all',
	startDT: '',			// need to restore for timeseries fetch
	endDT: ''
};

// Formatters/Utilities
var tickFormatter = function (value, index, values, type) {	
	if (type == "flow") {
		console.log("got value: "+value);
		return value.toString();
	}
	if (type == "temp") {
		return value.toString();
	}	
}

var toFahrenheit = function (temp) {
	return ( (temp!=null) ? ((temp * (9/5)) + 32) : null );
};
var toCelsius = function (temp) {
	return ( (temp!=null) ? ((temp - 32) * (5/9)) : null );
};

//	Graph Functions
var setupGraphStructures = function () {
	// axes & scales
	xAxis = {
		id: "xAxis",
		type: "time",		// can we pass the moment objects directly?
		position: "bottom",
		gridLines: { 
			display: true,
			color: '#ffffff',
			lineWidth: 1,
			borderDash: [5,2],
			zeroLineWidth: 1,
			zeroLineColor: '#ffffff'
		},
		time:  {
			unit: 'hour',
			displayFormats: {
				month: 'MM',
				day: 'DD',
				hour: 'ddd ha',
				minute: 'mm'
			},
			stepSize: 10,
			bounds: 'data',
			ticks: 'data'
		}
	};
	yAxis_flow = {
		id: "yAxis_flow",
		type: "linear",
		position: "right",
		display: true,
		gridLines: { display: false },
		ticks: {
			min: 0,
			max: 10
		},
		scaleLabel: {
			display: true,
			labelString: "Flow Rate (kcfs)",
			fontColor: plotColors.flow,
			fontSize: 14
		},
	}
	yAxis_flood = {
		id: "yAxis_flood",
		type: "linear",
		position: "left",
		gridLines: { display: false },
		ticks: {
			min: 0,
			max: 20
		},
		scaleLabel: {
			display: true,
			labelString: "Flood Stage (ft)",
			fontColor: plotColors.flood,
			fontSize: 14
		}
	};
	yAxis_temp = {
		id: "yAxis_temp",
		type: "linear",
		position: "left",
		gridLines: { display: false },
		ticks: {
			min: 0,
			max: 30,
			stepSize: 10,
			// callback: function (label, index, labels) {
			// 		return label + "˚C | " + toFahrenheit(Number.parseFloat(label)) + "˚F";
			// }
		},
		scaleLabel: {
			display: true,
			labelString: "Water Temperature (˚C)",
			fontColor: plotColors.temperature,
			fontSize: 14
		},
		color: plotColors.temp
	};
	graphScale = {
		xAxes: [xAxis],
		yAxes: [yAxis_flow, yAxis_temp, yAxis_flood]
	};
	
	// dataset wrapping
	flowDataset = {
		label: "Flow (kcfs)",
		borderColor: plotColors.flow,
		backgroundColor: plotColors.flow,
		fill: false,
		yAxisID: "yAxis_flow",
		data: ordinates.observed.flow
	};
	floodDataset = {
		label: "Flood Stage (ft)",
		borderColor: plotColors.flood,
		backgroundColor: plotColors.flood,
		fill: false,
		yAxisID: "yAxis_flood",
		data: ordinates.observed.flood
	};
	tempDataset = {
		label: "Water Temperature (˚C)",
		borderColor: plotColors.temperature,
		backgroundColor: plotColors.temperature,
		fill: false,
		yAxisID: "yAxis_temp",
		data: ordinates.observed.temp
	};
	graphData = {
		labels: abscissa.observed,
		datasets: [flowDataset, floodDataset, tempDataset]
	};
	
	// options, canvas, & settings
	graphOptions = {
		scales: graphScale,
		legend: {
			position: "bottom",
			labels: {
				fontColor: 'white'
			}
		},
		hidden: false,
		maintainAspectRatio: false
	};
	graphCanvas = $(selectors.graphCanvas).get(0);
	graphSettings = {
		type: "line",
		data: graphData,
		options: graphOptions
	};
};

var renderGraph = function () {
	Chart.defaults.color = 'white';
	Chart.defaults.elements.point.radius = 1;
	Chart.defaults.elements.line.borderWidth = 3;
	Chart.defaults.elements.line.tension = 0.8;
	theGraph = new Chart(graphCanvas, graphSettings);
};


// Data Parsing Functions
var parseFloodData = function (data) {
	// parse and extract most recent data first
	var latestObservedDatum = $(data).find('observed > datum:first');
	var latestObserved = {
		floodStageMeasurement: $(latestObservedDatum).find('primary').text(),
		floodStageUnits: $(latestObservedDatum).find('primary').attr('units'),
	};
	// get time-series and forecasted data
	var observedData = $(data).find('site > observed > datum');
	var observedDataN = observedData.length;
	var forecastData = $(data).find('site > forecast > datum');
	var forecastDataN = forecastData.length;
	for(var i = 0; i < observedDataN; i++) {
		var datum = $(observedData).get(i);
		var datetime = $(datum).children('valid').text();
		//datetime = datetime.substr(0,16);
		var flood = $(datum).children('primary').text();
		var aMoment = moment(datetime);
		moments.observed[i] = aMoment;
		abscissa.observed[i] = aMoment;
		ordinates.observed.flood[i] = Number.parseFloat(flood);
	}
	moments.forecast = [];
	abscissa.forecast = [];
	for(var i = 0; i < forecastDataN; i++) {
		var datum = $(forecastData).get(i);
		var datetime = $(datum).children('valid').text();
		//datetime = datetime.substr(0,16);
		var flood = $(datum).children('primary').text();
		var aMoment = moment(datetime);
		moments.forecast.push(aMoment);
		abscissa.forecast.push(aMoment);
		ordinates.forecast.flood[i] = Number.parseFloat(flood);
	}
	var obsmin = moment.min(moments.observed);
	var obsmax = moment.max(moments.observed);
	var tempReqFormat = "YYYY-MM-DDTHH:mm-0000";
	temperatureParameters.startDT = obsmin.format(tempReqFormat);
	flowParameters.startDT = obsmin.format(tempReqFormat);
	temperatureParameters.endDT = obsmax.format(tempReqFormat);
	flowParameters.endDT = obsmax.format(tempReqFormat);
};


// Data Parsing Functions
var parseFlowData = function (data) {
	let timeseries = data.value.timeSeries[0]
	let timeseriesdata = timeseries.values[0].value
	// parse and extract most recent data first
	var latestObservedDatum = timeseriesdata[0];
	
	var units = timeseries.variable.unit.unitCode;
	units = "kcfs"
	
	// get time-series and forecasted data
	var observedData = timeseriesdata;
	var observedDataN = observedData.length;
	for(var i = 0; i < observedDataN; i++) {
		var datum = observedData[i];
		var datetime = datum['dateTime'];
		//datetime = datetime.substr(0,16);
		var flow = Number.parseInt(datum['value'])/1000;
		var aMoment = moment(datetime);
		moments.observed[i] = aMoment;
		abscissa.observed[i] = aMoment;
		ordinates.observed.flow[i] = Number.parseFloat(flow);
	}
	var obsmin = moment.min(moments.observed);
	var obsmax = moment.max(moments.observed);
	var tempReqFormat = "YYYY-MM-DDTHH:mm-0000";
	temperatureParameters.startDT = obsmin.format(tempReqFormat);
	flowParameters.startDT = obsmin.format(tempReqFormat);
	floodParameters.startDT = obsmin.format(tempReqFormat);

	temperatureParameters.endDT = obsmax.format(tempReqFormat);
	flowParameters.endDT = obsmax.format(tempReqFormat);
	floodParameters.endDT = obsmax.format(tempReqFormat);
};

var parseTemperatureData = function (data) {
	var tempC = $(data.documentElement).children().find('wml2\\:value:first').text();
	var tempF = toFahrenheit(tempC);
	var latestObserved = {
		celsius: tempC,
		fahrenheit: tempF
	}

	// extract timeseries data
	var observedData = $(data.documentElement).children('wml2\\:observationMember').find('wml2\\:point')
	var observedDataN = observedData.length;
	for(var i = 0; i < observedDataN; i++) {
		var datum = $(observedData).get(i);
		var datetime = $(datum).find('wml2\\:time').text();
		var temp = $(datum).find('wml2\\:value').text();
		ordinates.observed.temp[i] = Number.parseFloat(temp);
	}
};

var populateDataSets = function () {
	$.ajax({
		url: floodSourceURI,
		data: floodParameters,
		datatype: 'xml',
		success: function (data) {
			parseFloodData(data);
			// hard-chain start
			$.ajax({
				url: temperatureSourceURI,
				data: temperatureParameters,
				datatype: 'xml',
				success: function (data) {
					parseTemperatureData(data);
				
					// hard-chain start
					$.ajax({
						url: flowSourceURI,
						data: flowParameters,
						datatype: 'json',
						success: function (data) {
							parseFlowData(data);
							renderGraph();
						}
					});
					// hard-chain end
				}
			});
			// hard-chain end
		}
	});

	// here: intervene to remove all data in flow and flood from before first temperature reading
	
	// await renderGraph();
};