'use strict';



var loader, tableLoader, query;
var pageSize = 10; // auto init in future
var chartsWidth = 6;

var chartSettings = {
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



async function fadeOut( elem ) {
  elem.style.opacity = '0';
  await setTimeout(() => {elem.style.zIndex = '-10'}, 200);
};


function fadeIn( elem ) {
	elem.style.zIndex = '999';
	elem.style.opacity = '1';
};


async function updateTable(query=null) {
  fadeIn(tableLoader);
  await setTimeout(() => {
    fadeOut(tableLoader);
  }, 500);
}


function groupBy( array, parameter ) {
  return array.reduce((r, a) => {
    r[ a[parameter] ] = [...r[ a[parameter] ] || [], a];
    return r;
  }, {});
};


async function get( path ) {
  return new Promise( (resolve, reject) => {
    const request = new XMLHttpRequest();
    const host = window.location.host;
    const url = `https://${host}/api/${path}`;

    request.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        resolve(request.response);

      } else if (this.readyState == 4) {
        console.error(`Request error ${this.status}`);
      };
    };

    request.open('GET', url, true);
    request.send();
  });  
}


async function groupData( data ) {
  let values = {
    to : {
      all : null,
      na  : null,
    },
    from : {
      all : null,
      na  : null,
      busy: null,
    },
  };
  
  let grouped = groupBy( data, 'dcontext' );
  let to = grouped['to'];
  let from = grouped['from'];
  
  values.to.all = to.length;
  values.from.all = from.length;
  
  let toGrouped = groupBy( to, 'disposition' );
  values.to.na = toGrouped['NO ANSWER'].length;
  
  let fromGrouped = groupBy( from, 'disposition' );
  values.from.na = fromGrouped['NO ANSWER'].length;
  values.from.busy = fromGrouped['BUSY'].length;

  // charts
  //let toChart = [];
  //let fromChart = [];
  //
  //while ( to.length ) {
  //  toChart.push( to.splice(0, 20) );
  //};
  //
  //while ( from.length ) {
  //  fromChart.push( from.splice(0, 20) );
  //};
  ///////
  
  let pages = [];
  
  while ( data.length ) {
    pages.push( data.splice(0, pageSize) );
  };

  return { values, pages };
  
};


async function initPage( { values, pages } ) {
  let queryString = `${query[0]}- ${query[1]}`;
  let formatedQuery = queryString.replace(/_|\//g, ' ');
  document.getElementById('query').innerText = formatedQuery;

  let ingoing = document.getElementById('ingoingCalls');
  ingoing.innerText = values.to.all;
  
  let outgoing = document.getElementById('outgoingCalls');
  outgoing.innerText = values.from.all;
}


async function requestData() {
  query = [
    document.getElementById('from').value,
    document.getElementById('to').value,
  ];

  if ( query[0] && query[1] ) {
    for ( let i = 0; i < query.length; i++ ) {
      query[i] += '_00:00:00/';
    };

    let requestLink = `callStatistics/${query[0]}${query[1]}`;
    let rawJSON = await get( requestLink );
    return JSON.parse( rawJSON );
    
  };
};


async function submitQuery() {
  let startTime = Date.now();

  fadeIn(loader);

  let data = await requestData();
  let formatedData = await groupData( data );

  initPage( formatedData );

  let endTime = Date.now();
  let requestTime = endTime - startTime;

  console.log('Request time:', reqestTime );

  let toWait = requestTime<200? 200-requestTime:0 

  await setTimeout(() => {
    query.style.display = 'none';
    fadeOut(loader);
  }, toWait);
}


window.onload = function() {

  if (!Date.now) {
    Date.now = function now() {
      return new Date().getTime();
    };
  }


  // new Chartist.Line('.chart-daily', data_dl, settings);
  // new Chartist.Line('.chart-hourly', data_hl, settings);

  // Remove Loader when all downloaded
  loader = document.getElementById('loader');
  tableLoader = document.getElementById('tableLoader');
  query = document.getElementById('queryBack');

  fadeOut(loader)
};



//////////////////////////////

// comment charts first
// its to complicated now