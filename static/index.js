'use strict';



var loader, tableLoader, queryPage, query, data;
var currentPage;
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
      	resolve( this.status );
      };
    };

    request.open('GET', url, true);
    request.send();
  });  
}


async function error( response ) {
  if ( Number.isInteger(response) ) {
    let errorMap = {
      400 : 'Запрос не верный',
      404 : 'Не найдено',
      500 : 'Ошибка сервера'
    };

    let message = errorMap[response] || 'Неизвестная ошибка';
    let errorBox = document.querySelector('.notifyField');
    let newError = document.createElement('div');

    newError.className = 'notify';
    newError.innerHTML += `<i class="fas fa-exclamation"></i>
                           <p>${ message }</p>`;

    errorBox.appendChild(newError);
    return true;

  } else {
   	return false;
  };
}


async function groupData() {
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
  values.to.na = toGrouped['NO ANSWER']? toGrouped['NO ANSWER'].length:0;
  
  let fromGrouped = groupBy( from, 'disposition' );
  values.from.na = fromGrouped['NO ANSWER']? fromGrouped['NO ANSWER'].length:0;
  values.from.na += fromGrouped['FAILED']? fromGrouped['FAILED'].length:0;
  values.from.busy = fromGrouped['BUSY']? fromGrouped['BUSY'].length:0;

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

  return values;
  
};


async function tableShowPage( num ) {
  currentPage = num;

	let startTime = Date.now();
  fadeIn( tableLoader );

  let filterIn = document.getElementById('in');
  let filterOut = document.getElementById('out');
  let filterAnswer = document.getElementById('answer');
  let filterNoAnswer = document.getElementById('noanswer');

  let filter = {
    'in'      : filterIn.checked,
    'out'     : filterOut.checked,
    'answer'  : filterAnswer.checked,
    'noanswer': filterNoAnswer.checked,
  };

  let filteredData = [];

  for ( let i = 0; i < data.length; i++ ) {
    let isIn = data[i][ 'dcontext' ] == 'to';
    let isOut = data[i][ 'dcontext' ] == 'from';
    let isAnswer = data[i][ 'disposition' ] == 'ANSWERED';
    let isNoAnswer = data[i][ 'disposition' ] != 'ANSWERED';

    if ( (( isIn == filter[ 'in' ] && isIn ) ||
    	   ( isOut == filter[ 'out' ] && isOut )) &&
    	   (( isAnswer == filter[ 'answer' ] && isAnswer ) ||
    	   ( isNoAnswer == filter[ 'noanswer' ] && isNoAnswer )) ) {
    	filteredData.push( data[i] );
    };
  };

  let overall = filteredData.length;
  let pageInfo = document.getElementById('pageInfo');
  pageInfo.innerText = `${ pageSize } из ${ overall }`;

  var pages = [];
  while ( filteredData.length ) {
    pages.push( filteredData.splice(0, pageSize) );
  };

  let endTime = Date.now();
  let diff = endTime - startTime;
  let toWait = diff<300? 300-diff:0

  await setTimeout(() => {

	  var table = document.getElementById('table');
    var tablePages = document.getElementById('pages');

	  let pagesContent = '';
    let tableContent = '';
	  tableContent += "<tr class='tableNames'> \
							       <td>Направление</td> \
							       <td>Время</td> \
							       <td>Номер</td> \
							       <td>Статус</td> \
							       <td>Длительность</td> \
							       <td>Запись</td> \
						         </tr>"

	  let page = pages[ num - 1 ];

	  let direcMapping = {
	    'to'   : 'Входящий',
	    'from' : 'Исходящий',
	  };

	  let dispMapping = {
	    'NO ANSWER' : 'Без Ответа',
	    'FAILED'    : 'Без Ответа',
	    'BUSY'      : 'Сброшен',
	    'ANSWERED'  : 'Отвечен',
	  };

	  let colorMapping = {
      'to'   : 'green',
      'from' : 'yellow',
	  };

    if ( page && pages ) {
		  for ( let i = 0; i < page.length; i++ ) {
		    let content = page[i];
		    let number = content.dcontext == 'to'? 'src':'dst';
		    tableContent += `<tr class='tableValues'> \
								        <td class='${ colorMapping[ content['dcontext'] ] }'> \
								        ${ direcMapping[ content['dcontext'] ] }</td> \
	                      <td>${ content['calldate'] }</td> \
								        <td>${ content[number] }</td> \
								        <td>${ dispMapping[ content['disposition'] ] }</td> \
								        <td>${ content['billsec'] }</td> \
								        <td> \
									      <a href="#" onclick="getRec(${ content['uniqueid'] });\
									      return false"><i class="far fa-play-circle"></i> \
									      </a> \
								        </td> \
							          </tr>`;
		  };

      for ( let i = 0; i < pages.length; i++ ) {
        let pageNum = i + 1;
        pagesContent += `<a href="#" class='pagesContainer' \
                        onclick='tableShowPage(${pageNum});return false'>\
                        ${pageNum}</a>`
      };

		} else {
      console.error("There's nothing to show");
		};

    table.innerHTML = tableContent;
    tablePages.innerHTML = pagesContent;

    fadeOut( tableLoader );
  }, toWait);
}


async function getRec( id ) {
  let response = await get( `recordingFile/${id}` );
  let { path } = JSON.parse( response );

  if ( error( path ) ) {
    error('Запись не найдена');

  } else if ( path ) {
    window.open( path, '_blank' );

  };
}


function tableReloadPage() {
  tableShowPage( 1 );
};


function goBack() {
  query = null;
  data = null;
  queryPage.style.zIndex = 100;
  queryPage.style.opacity = 1;
};



async function initPage( values ) {
  let queryString = `${query[0]}- ${query[1]}`;
  let formatedQuery = queryString.replace(/_|\//g, ' ');
  document.getElementById('query').innerText = formatedQuery;

  let ingoing = document.getElementById('ingoingCalls');
  ingoing.innerText = values.to.all;

  let inMissed = document.getElementById('inMissed');
  inMissed.innerText = values.to.na;  
  
  let outgoing = document.getElementById('outgoingCalls');
  outgoing.innerText = values.from.all;

  let outMissed = document.getElementById('outMissed');
  outMissed.innerText = values.from.na;

  let outBusy = document.getElementById('outBusy');
  outBusy.innerText = values.from.busy;
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
    data = JSON.parse( rawJSON );
    
  };
};


async function submitQuery() {
  let startTime = Date.now();

  fadeIn( loader );

  await requestData();

  console.log(data)

  if ( !error(data) ) {
  	console.log('im here')
    let formatedData = await groupData();

    initPage( formatedData );
    tableShowPage( 1 );
  };

  let endTime = Date.now();
  let requestTime = endTime - startTime;

  console.log('Request and format time:', requestTime );

  let toWait = requestTime<200? 200-requestTime:0;

  await setTimeout(() => {
    queryPage.style.zIndex = -20;
    queryPage.style.opacity = 0;
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
  queryPage = document.getElementById('queryBack');

  fadeOut(loader)
};



//////////////////////////////

// comment charts first
// its to complicated now