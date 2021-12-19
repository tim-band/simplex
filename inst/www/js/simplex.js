// 1. Startup

var glob = {
    'simplex': {
	'method': { 'method': ['IGG-UPb'] },
	'samples': null,
	'outliers': null,
	'standard': null,
	'calibration': null,
	'calibrated': null
    },
    'i': 0,
    'start': true,
    'names': null,
    'class': 'simplex',
    'multi': false,
    'selected': 0,
    'ratios': true,
    'log': true,
    'xy': false,
    'sampleprefix': null,
    'standards': [],
    'fixedslope': false,
    'slope': 1,
    'datatype': null,
    'buttonIDs': ['setup','drift','logratios','calibration','samples','finish']
}

function start() {
    // This will be moved into shinylight.initialize()
    new Promise((resolve, reject) => {
        rrpc.initialize(() => resolve(), error => reject(error));
    }).then(() =>
        setup()
    );
}

function selectedButton() {
    return document.getElementById(
        glob.buttonIDs[glob.selected]
    );
}

function selectButton(i){
    selectedButton().classList.remove('on')
    glob.selected = i;
    selectedButton().classList.add('on')
}

async function loadPage(url) {
    let response = await fetch(url);
    let text = await response.text();
    document.getElementById("contents").innerHTML = text;
}

// 2. Setup

function setup(){
    selectButton(0);
    loadPage("setup.html").then(
        () => {
	    initpreset();
	    if (glob.start) loadPresets()
	    else showPresets()
	    glob.start = false;
	},
        error => alert(error)
    );
}

function initpreset(){
    document.getElementById("methods").value = glob.simplex.method.method[0];
}

function loadPresets(){
    const m = document.getElementById("methods").value;
    glob.simplex.method.method[0] = m;
    shinylight.call('presets', { method: m }, null)
	.then(
	    result => result2simplex(result),
	    err => alert(err)
	)
	.then(
	    () => shinylight.call('getdatatype', { x: glob }, null).then(
		result => {
		    glob.datatype = result.data[0]
		    showPresets();
		    fileFormats();
		},
		error => alert(error)
	    )
	)
}

function method(el){
    glob.simplex.method[el.id] = el.value.split(',')
    glob.class = ['simplex']; // reset calculations
}

function renameIons(){
    let ions = glob.simplex.method.ions;
    let keys = Object.keys(glob.simplex.samples);
    for (let i=0; i<keys.length; i++){
	glob.names.samples[keys[i]].detector = ions;
	glob.names.samples[keys[i]].dtype = ions;
	glob.names.samples[keys[i]].dwelltime = ions;
	glob.names.samples[keys[i]].sbm.cnames = ions;
	glob.names.samples[keys[i]].signal.cnames = ions;
	glob.names.samples[keys[i]].time.cnames = ions;
    }
}

function showPresets(){
    let assign = (id) => document.getElementById(id).value =
	glob.simplex.method[id];
    assign('description');
    assign('instrument');
    assign('ions');
    assign('num');
    assign('den');
    assign('blank');
}

function show(cls){
    let set = document.querySelectorAll(cls);
    if (set==null) return    
    document.querySelectorAll(cls).forEach(
	function(item){
	    item.classList.remove("hidden");
	});
}
function hide(cls){
    let set = document.querySelectorAll(cls);
    if (set==null) return
    document.querySelectorAll(cls).forEach(
	function(item){
	    item.classList.add("hidden");
	});
}

function stable(){
    return(["oxygen","sulphur"].includes(glob.datatype))
}

function geochron(){
    return(["U-Pb","Th-Pb"].includes(glob.datatype))
}

function fileFormats(){
    let accept = ['.asc','.op','.pd'];
    if (glob.simplex.method.instrument=='Cameca'){
	accept = '.asc';
    } else if (glob.simplex.method.instrument=='SHRIMP'){
	accept = ['.op','.pd'];
    } else {
	alert('Unrecognised instrument.')
    }
    document.getElementById('upload').accept = accept;
}

// From https://masteringjs.io/tutorials/fundamentals/filereader
function readFile(file) {
    return new Promise((resolve, reject) => {
	const reader = new FileReader();
	reader.onload = res => {
	    resolve(res.target.result);
	};
	reader.onerror = err => reject(err);
	reader.readAsText(file);
    });
}

// read all files for conversion to textConnection
async function readFiles(){
    let status = document.getElementById('upload-status');
    let f = document.getElementById('upload').files;
    let fns = {};
    let tcs = {};
    for (let i=0; i<f.length; i++){
	status.innerHTML = " Loading file " + (i+1) + " of " + f.length;
	fns[i] = f[i].name;
	tcs[i] = await readFile(f[i]);
	status.innerHTML = (i==f.length-1) ? "" :
	    " Loaded file " + (i+1) + " of " + f.length;

    }
    return({fns:fns, tcs:tcs})
}

async function upload(){
    readFiles().then(
	f => {
	    shinylight.call('upload', {f:f, x:glob}, null).then(
		result => {
		    result2simplex(result);
		    document.getElementById('ions').value =
			glob.simplex.method.ions.toString();
		    document.getElementById('num').value =
			glob.simplex.method.num.toString();
		    document.getElementById('den').value =
			glob.simplex.method.den.toString();
		},
		error => alert(error)
	    )
	},
	err => alert(err)
    )
}

function result2simplex(result){
    glob.simplex = result.data.simplex;
    glob.names = result.data.names;
    glob.class = result.data.class;
    glob.multi = result.data.multi[0];
}

// 3. Drift

async function drift(){
    selectButton(1);
    loadPage("drift.html").then(
	() => {
	    if (glob.class.includes('drift')){ // already drift corrected
		loadSamples( () => initDrift() )
	    } else { // not yet drift corrected
		loader();
		shinylight.call("getdrift", {x:glob}, null, extra()).then(
		    result => result2simplex(result),
		    error => alert(error)
		).then(
		    () => loadSamples( () => initDrift() ),
		    error => alert(error)
		).then(
		    () => shower(),
		    error => alert(error)
		)
	    }
	},
	error => alert(error)
    )
}

function checkratios(){
    glob.ratios = document.getElementById("ratiocheckbox").checked;
}
function checklog(){
    glob.log = document.getElementById("logcheckbox").checked;
}
function checkxy(){
    glob.xy = document.getElementById("xycheckbox").checked;
}

function loader(){
    show('.show4loading');
    hide('.hide4loading');
}

function shower(){
    show('.hide4loading');
    hide('.show4loading');
}

function loadSamples(callback){
    let select = document.getElementById("aliquots");
    let samples = glob.simplex.samples;
    let keys = Object.keys(samples);
    for (let i = 0; i<keys.length; i++) {
	let el = document.createElement("option");
	el.textContent = keys[i];
	el.value = i;
	select.appendChild(el);
    }
    callback();
}

function loadTable(dat,header,id,nr){
    let nc = header.length;
    let e = document.getElementById(id);
    e.deg = createDataEntryGrid(id,header,nr);
    e.deg.putCells(0,nr+1,0,nc+1,dat);
}

function initDrift(){
    document.getElementById("aliquots").value = glob.i;
    driftAliquot();
}

function deepcopy(object){
    return(JSON.parse(JSON.stringify(object)))
}

function driftAliquot(){
    glob.i = parseFloat(document.getElementById("aliquots").value);
    let keys = Object.keys(glob.simplex.samples);
    let header = glob.simplex.method.ions;
    let dat = glob.simplex.samples[keys[glob.i]];
    loadTable(dat.time,header,'time-table',dat.time.length);
    loadTable(dat.signal,header,'signal-table',dat.signal.length);
    document.getElementById('outliers').value =
	(dat.outliers===undefined) ? '' : dat.outliers;
}

function backnforth(di,callback){
    let keys = Object.keys(glob.simplex.samples);
    let ns = keys.length;
    glob.i = ((glob.i + di % ns) + ns) % ns; // modulo operation
    document.getElementById("aliquots").value = glob.i;
    callback();
}

function driftPlot(){
    let keys = Object.keys(glob.simplex.samples);
    let ostring = document.getElementById('outliers').value;
    if (ostring===''){
	delete glob.simplex.samples[keys[glob.i]].outliers;
    } else {
	glob.simplex.samples[keys[glob.i]].outliers = ostring.split(',',10).map(Number);
    }
    shinylight.call('driftPlot', {x:glob},
		    'drift-plot', {'imgType': 'svg'}).then(
			result => {
			    result2simplex(result);
			    shinylight.setElementPlot('drift-plot', result.plot);
			},
			error => alert(error)
		    );
}

function getOutliers(i){
    let e = document.getElementById('drift-plot');
    let omit = e.deg.getColumn(0);
    return(omit);
}

// 3. Logratios

async function logratios(){
    selectButton(2);
    loadPage("logratios.html").then(
	() => {
	    if (glob.class.includes('logratios')){ // already has logratios
		loadSamples( () => initLogratios() );
		document.getElementById("ratiocheckbox").checked = glob.ratios;
		document.getElementById("logcheckbox").checked = glob.log;
		if (glob.simplex.method.instrument=='Cameca'){
		    show('.show4cameca');
		    document.getElementById("xycheckbox").checked = glob.xy;
		} else {
		    hide('.show4cameca');
		    glob.xy = false;
		}
	    } else { // does not yet have logratios
		loader();
		shinylight.call("getlogratios", {x:glob}, null, extra()).then(
		    result => result2simplex(result),
		    error => alert(error)
		).then(
		    () => {
			loadSamples( () => initLogratios() );
			document.getElementById("ratiocheckbox").checked = glob.ratios;
			document.getElementById("logcheckbox").checked = glob.log;
			document.getElementById("xycheckbox").checked = glob.xy;
		    },
		    error => alert(error)
		).then(
		    () => shower(),
		    error => alert(error)
		)
	    }
	},
	error => alert(error)
    )
}

function initLogratios(){
    document.getElementById("aliquots").value = glob.i;
    logratioAliquot();
}

function extra(){
    var extra = {
        'info': function(text) {
            shinylight.setElementText('status', text);
        },
        'progress': function(numerator, denominator) {
            const pc = Math.ceil(numerator * 100 / denominator);
	    let nbars = 20;
	    let ndone = Math.ceil(numerator*nbars/denominator);
	    let done = '|'.repeat(ndone);
	    let todo = '.'.repeat(nbars-ndone);
            shinylight.setElementText('progress', done + todo + ' ' + pc + '%');
        },
	'imgType': 'svg'
    }
    return(extra)
}

function logratioAliquot(){
    glob.i = parseFloat(document.getElementById("aliquots").value);
    let key = Object.keys(glob.simplex.samples)[glob.i];
    let header = glob.names.samples[key].lr.b0g;
    let dat =  glob.simplex.samples[key];
    let b0g = dat.lr.b0g;
    let ns = header.length/2;
    loadTable([b0g.slice(0,ns)],header.slice(0,ns),'b0',1);
    loadTable([b0g.slice(ns,2*ns)],header.slice(ns,2*ns),'g',1);
    document.getElementById('outliers').value =
	(dat.outliers===undefined) ? '' : dat.outliers;
}

function logratioPlot(){
    show('.plot');
    hide('.table');
    let ostring = document.getElementById('outliers').value;
    let key = Object.keys(glob.simplex.samples)[glob.i];
    if (ostring===''){
	delete glob.simplex.samples[key].outliers;
    } else {
	glob.simplex.samples[key].outliers = ostring.split(',',10).map(Number);
    }
    shinylight.call('logratioPlot',
		    {x:glob, ratios:glob.ratios},
		    'logratio-plot',
		    {'imgType': 'svg'})
	.then(
	    result => shinylight.setElementPlot('logratio-plot', result.plot),
	    error => alert(error)
	);
}

function logratioTable(){
    show('.table');
    hide('.plot');
    shinylight.call("logratioTable", {x:glob}, null).then(
	result => {
	    let nr = result.data.length;
	    let header = Object.keys(result.data[0]);
	    let tab = createDataEntryGrid('logratio-table', header, nr);
	    shinylight.setGridResult(tab, result);
	},
	error => alert(error)
    );
}

// 4. Calibration

function calibration(){
    selectButton(3);
    loadPage("calibration.html").then(
	() => {
	    // I
	    document.getElementById('caltype').selectedIndex =
		(glob.simplex.calibration.hasOwnProperty('pairing')) ? 1 : 0;
	    togglecaltype();
	    // II
	    setstandcomp();
	    // III
	    setstandsel();
	},
	error => alert(error)
    );
}

// I.
function togglecaltype(){
    let val = document.getElementById('caltype').selectedIndex;
    if (val === 0){
	show('.show4stable');
	hide('.hide4stable');
    } else {
	show('.show4geochron');
	hide('.hide4geochron');
	setpairing();
    }
}
function setpairing(){
    let pairing = glob.simplex.calibration.pairing;
    let nr = pairing.length;
    let header = Object.keys(pairing[0]);
    let val = [new Array(nr)];
    for (let i=0; i<nr; i++){
	val[i] = Object.values(pairing[i]);
    }
    loadTable(val,header,'pairing',nr);
}
function getpairing(){
    let e = document.getElementById('pairing');
    let pairing = glob.simplex.calibration.pairing;
    let nr = pairing.length;
    let header = Object.keys(pairing[0]);
    let dat = e.deg.getCells();
    for (let i=0; i<nr; i++){
	for (let j=0; j<header.length; j++){
	    pairing[i][header[j]] = dat[i][j];
	}
    }
}

// II.
function setstandcomp(){
    let stand = glob.simplex.calibration.stand;
    let header = glob.names.calibration.stand.val;
    let nr = header.length;
    let val = [stand.val];
    let cov = stand.cov;
    loadTable(val,header,'standlr',1);
    loadTable(cov,header,'standcov',nr);
}
function togglestandcomp(){
    let val = document.getElementById('standcomp').value;
    if (val === 'prefix2stand'){
	show('.show4prefix');
    } else {
	hide('.show4prefix')
    }    
}

// III.
function setstandsel(){
    if (glob.standards.length>0){
	markStandards();
    } else {
	let cal = glob.simplex.calibration;
	let hasprefix = cal.hasOwnProperty('prefix');
	if (!hasprefix) cal.prefix === '';
	document.getElementById('prefix').value = cal.prefix;
	prefix2standards();	
    }
    markStandards();
}
function prefix2standards(){
    let keys = Object.keys(glob.simplex.samples);
    let prefix = glob.simplex.calibration.prefix;
    glob.standards = [];
    for (let i=0; i<keys.length; i++){
	if (keys[i].indexOf(prefix) !== -1){
	    glob.standards.push(keys[i]);
	}
    }
}
function updateStandardPrefix(){
    glob.simplex.calibration.prefix = document.getElementById('prefix').value;
    prefix2standards();
    markStandards();
}
function markStandards(){
    let keys = Object.keys(glob.simplex.samples);
    let nk = keys.length;
    let dat = new Array(nk);
    let standards = glob.standards;
    for (let i=0; i<nk; i++){
	if (standards.includes(keys[i])){
	    dat[i] = [keys[i],'yes'];
	} else {
	    dat[i] = [keys[i],'no'];
	}
    }
    loadTable(dat,['aliquots','selected?'],'aliquots',nk);
}

// IV.
function calibrator(){
    registerStandards();
    shinylight.call('calibrator', {x:glob},
		    'calibration-plot', {'imgType': 'svg'}).then(
	result => {
	    result2simplex(result),
	    shinylight.setElementPlot('calibration-plot', result.plot)
	},
	error => alert(error)
    )
}
function registerStandards(){
    let e = document.getElementById('aliquots');
    let dat = e.deg.getColumns();
    glob.standards = [];
    for (let i=0; i<dat.aliquots.length; i++){
	if (dat['selected?'][i]==='yes') glob.standards.push(dat.aliquots[i]);
    }
}

// 5. samples
function samples(){
    selectButton(4);
    loadPage("samples.html").then(
	() => markSamplesByPrefix(),
	error => alert(error)
    );
}

function markSamplesByPrefix(){
    glob.sampleprefix = document.getElementById('prefix').value;
    let keys = Object.keys(glob.simplex.samples);
    let nk = keys.length;
    let dat = new Array(nk);
    for (let i=0; i<nk; i++){
	if (keys[i].indexOf(glob.sampleprefix) !== -1){
	    dat[i] = [keys[i],'yes'];
	} else {
	    dat[i] = [keys[i],'no'];
	}
    }
    loadTable(dat,['aliquots','selected?'],'aliquots',keys.length);
}

function calibrate(){
    shinylight.call("calibrateSamples",
		    {x:glob},
		    'sample-calibration-plot',
		    {'imgType': 'svg'}).then(
	result => shinylight.setElementPlot('sample-calibration-plot', result.plot),
	error => alert(error)
    )
}

// 6. finish

function finish(){
    selectButton(5);
    loadPage("finish.html").then(
	() => {
	    if (stable()) hide('.hide4stable')
	    else show('.hide4stable')
	    document.getElementById('prefix').value = glob.sampleprefix;
	    markSamplesByPrefix();
	}, error => alert(error)
    );
}

function plotresults(){
    hide('.hide4plot');
    show('.hide4table');
    shinylight.call("plotresults", {x:glob}, 'final-plot',
		    {'imgType': 'svg'}).then(
	result => shinylight.setElementPlot('final-plot', result.plot),
	error => alert(error)
    );
}

function resultstable(){
    hide('.hide4table');
    show('.hide4plot');
    shinylight.call("resultstable", {x:glob}, null).then(
	result => {
	    let nr = result.data.length;
	    let header = Object.keys(result.data[0]);
	    let tab = createDataEntryGrid('final-table', header, nr);
	    shinylight.setGridResult(tab, result);
	},
	error => alert(error)
    );
}

function export2isoplotr(){
    glob.IsoplotRformat = document.getElementById("format").value;
    var json = null;
    fetch('js/IsoplotR.json')
	.then(response => {
	    if (!response.ok) {
		throw new Error("HTTP error " + response.status);
	    } else {
		return response.json();
	    }
	}).then(
	    result => json = result,
	    err => alert(err)
	).then(
	    async () => {
		let result = await shinylight.call('export2isoplotr', { x:glob }, null);
		let gc = null;
		let pd = null;
		let format = null;
		switch (glob.datatype){
		case 'U-Pb':
		    gc = 'U-Pb';
		    pd = 'concordia';
		    format = 5;
		    break;
		case 'Th-Pb':
		    gc = 'Th-Pb';
		    pd = 'isochron';
		    format = 2;
		    break;		    
		}
		json.settings.geochronometer = gc;
		json.settings.plotdevice = pd;
		json.settings[gc].format = format;
		json.data[gc] = result;
	    },
	    err => alert(err)
	)
	.then(
	    () => {
		let fname = prompt("Please enter a file name", "simplex.json");
		if (fname != null){
		    document.getElementById('fname').setAttribute(
			"href","data:text/plain," + JSON.stringify(json)
		    );
		    document.getElementById('fname').setAttribute("download",fname);
		    document.getElementById('fname').click();
		}
	    },
	    err => alert(err)
	);
}
