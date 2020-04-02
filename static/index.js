//"use strict"

class Charts {
  constructor() {
    this.charts = {
      'inout'  : {
      	'class'   : '',
      	'instance': null
      },
      'overall': {
      	'class'   : '',
      	'instance': null
      },
      'timing' : {
      	'class'   : '',
      	'instance': null
      },
    };
  }

  create() {
    
  };

}


var loader, tableLoader, query

async function requestData(from=null, to=null) {
	return true;
};

async function fadeOut(elem) {
  elem.style.opacity = '0';
  await setTimeout(() => {elem.style.zIndex = '-10'}, 200);
};

function fadeIn(elem) {
	elem.style.zIndex = '999';
	elem.style.opacity = '1';
};

async function submitQuery() {
	let downloaded;
  let data;

  fadeIn(loader);
  data = requestData();
  await setTimeout(() => {
    query.style.display = 'none';
    fadeOut(loader);
  }, 200);
}

async function updateTable(query=null) {
  fadeIn(tableLoader);
  await setTimeout(() => {
    fadeOut(tableLoader);
  }, 500);
}

// testing area
window.onload = function() {

	var settings = {
    low: 0,
    high: 8, // must be bigger than highest value
    height: 250,
    showArea: true,
    fullWidth: true,
    axisY: {
      onlyInteger: true,
      offset: 20
    },
    plugins: [
      Chartist.plugins.ctPointLabels({
        textAnchor: 'middle',
        labelInterpolationFnc: val => { return val? val:'0' }
      })
    ]
	};

  var data_dl = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    series: [
      [5, 2, 4, 2, 1],
      [7, 5, 5, 6, 7]
    ]
  };

  var data_hl = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    series: [
      [3, 2, 1, 0, 1],
      [1, 3, 2, 1, 4]
    ]
  };

  new Chartist.Line('.chart-daily', data_dl, settings);
  new Chartist.Line('.chart-hourly', data_hl, settings);



  // Remove Loader when all downloaded
  loader = document.getElementById('loader');
  tableLoader = document.getElementById('tableLoader');
  query = document.getElementById('queryBack');
  fadeOut(loader)

};