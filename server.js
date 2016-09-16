console.log("Formie Server v1");
console.log("WARNING: Concurrency and request validation not fully implemented");

var Promise = require("bluebird");
var express = require('express');
var fs = require("fs");
var bodyParser = require('body-parser');
var morgan = require('morgan');
var shortid = require('shortid');
var _ = require('lodash');
var inspector = require('schema-inspector');

var database = "db.json";

var webServer = express(); // It's starting the http server


function Queue()
{
	this.queue = []; // Ensures that commands run in a chronological order
	this.noTrigger = true;
}
Queue.prototype.add = function(prom){
	this.queue.push(prom);
	if(this.noTrigger) this.run();
}
Queue.prototype.run = function(){
	var me = this;
	me.noTrigger = false;
	 me.queue.shift()().then(function(){
		if(me.queue.length == 0)
			me.noTrigger = true;
		else
			me.run();
	});
}

//database transasctions are managed by a queue
//so under heavy load concurrent requests will not intefere with each other
var dbQueue = new Queue();


//test the queue
dbQueue.add(function(){
	return new Promise(function(res,rej){
		setTimeout(function(){console.log("a:1");},10);
		setTimeout(function(){console.log("a:2");},20);
		setTimeout(function(){console.log("a:3");res();},30);
	})
});

dbQueue.add(function(){
	return new Promise(function(res,rej){
		setTimeout(function(){console.log("b:1");},10);
		setTimeout(function(){console.log("b:2");},15);
		setTimeout(function(){console.log("b:3");res();},17);
	})
});


//generate some random ids to console
for(var i=0; i<5; i++){
	console.log(shortid.generate());
}

var enableWrites = true;

var forms, fields, submissions;

//print request info to console
webServer.use(morgan("-----------\\n:method  :url\\n-----------\\nRES-TIME: :response-time ms\\nREMOTE-ADDRESS: :remote-addr\\n-----------\\n\\n"));
webServer.use(bodyParser.urlencoded({ extended: false }));
webServer.use(bodyParser.json());

//initial db load
reloadDatabase(function(){
		webServer.listen(3000, function () {
		console.log('HTTP server listening on port 3000!');
	});
});

function saveDatabase(callback){
	console.log("saving " + database + " ...");
	if(!enableWrites) return console.log("Writes disabled");
	fs.writeFile(database, JSON.stringify({"forms": forms, "fields": fields, "submissions": submissions}, null, "\t"), "utf8", function(){
		console.log(database + "saved");
		if(typeof callback !== 'undefined') callback();
	});
}

function reloadDatabase(callback){
	console.log("loading " + database + " ...");
	var source = require("./"+database);
	forms = source.forms;
	fields = source.fields;
	submissions = source.submissions;
	console.log(database + " loaded");
	if(typeof callback !== 'undefined') callback();
}

webServer.get('/homepage', function(req, res) {
	var build = {forms: {}, submissions: {}};
	for(var formKey in forms){
		build.forms[formKey] = {};
		build.forms[formKey].name = forms[formKey].name;
	}
	for(var submissionKey in submissions){
		build.submissions[submissionKey] = {};
		build.submissions[submissionKey].name = submissions[submissionKey].name;
	}
	res.send(build);
});

webServer.get('/accountsettings', function(req, res) {
	var build = {forms: {}, submissions: {}};
	for(var formKey in forms){
		build.forms[formKey] = {};
		build.forms[formKey].name = forms[formKey].name;
	}
	for(var submissionKey in submissions){
		build.submissions[submissionKey] = {};
		build.submissions[submissionKey].name = submissions[submissionKey].name;
	}
	res.send(build);
});

webServer.get('/form/manage', function(req, res) {
	var build = {};
	for(var formKey in forms){
		build[formKey] = {};
		build[formKey].name = forms[formKey].name;
		build[formKey].submissionCount = 0;

		for(var submissionID in submissions){
			if (submissions[submissionID].formID == formKey)
			{
				build[formKey].submissionCount++;
			}
		}
	}
	res.send(build);
});

webServer.get('/form/get/:id', function(req, response) {
	var result = {};
	result.form = _.pick(forms[req.params.id], ['name']);
	result.fields = _.pick(fields, forms[req.params.id].fields);
	response.send(result);
});

webServer.post('/form/new', function(req, response) {
	var validation = {
		type: 'object',
		properties: {
			name: {type: "string"},
			fields: {
				type: "array",
				items: {
					type: "object",
					properties: {
						type: {type: "string"},
						name: {type: "string"},
						helper: {type: "string"},
						required: {type: "boolean"}
					}
				}
			}
		}
	};
	var validation = inspector.validate(validation, req.body);
	if(!validation.valid) return response.status(400).send("request validation failed.");

	//validate field types
	for(var i=0; i < req.body.fields.length; i++){
		if(req.body.fields[i].type != "text") return response.status(400).send("request validation failed.");
	}

	dbQueue.add(function(){
		return new Promise(function(resolve, rej){
			console.log(req.body);
			var formID = shortid.generate();
			var fieldIDs = [];

			for(var i = 0; i < req.body.fields.length; i++){
				var fieldID = shortid.generate();
				fieldIDs.push(fieldID);
				fields[fieldID] = req.body.fields[i];
			}
			forms[formID] = {name: req.body.name, fields: fieldIDs, enabled: true};
			saveDatabase();
			resolve();
			response.send('success');
			return;
		})
	});
});

webServer.post('/form/submit', function(req, response) {
	var validation = {
		type: 'object',
		properties: {
			formID: {type: "string"},
			fields: {
				type: "array",
				items: {
					type: "object",
					properties: {
						fieldID: {type: "string"},
						value: {type: "string"}
					}
				}
			}
		}
	};

	var validation = inspector.validate(validation, req.body);
	if(!validation.valid) return response.status(400).send("request validation failed.");

	var submissionID = shortid.generate();

	dbQueue.add(function(){
		return new Promise(function(resolve, rej){
			//check if form exists in db
			if(typeof forms[req.body.formID] === 'undefined'){
				resolve();
				response.status(400).send("form dosen't exist");
				return;
			}
			//check if form is enabled
			if(!forms[req.body.formID].enabled){
				resolve();
				response.status(400).send("form disabled");
				return;
			}
			//check if the fields provided by client matches fields in db form
			if(_.difference(forms[req.body.formID].fields, _.map(req.body.fields, 'fieldID')).length > 0){
				resolve();
				response.status(400).send("field mismatch");
				return;
			}
			//success
			submissions[submissionID] = {fields: req.body.fields, formID: req.body.formID};
			saveDatabase();
			resolve();
			response.send('success');
			return;
		})
	});
});

webServer.use(express.static('static'));


//BENCHMARK REQUEST RATE
var queueCount = 10000;
var start = new Date();
for(var i = 0; i < queueCount; i++){
	dbQueue.add(function(){
		return new Promise(function(resolve, rej){
			var demo = {"formID": "H1bpq3jFq", "fields": [{"fieldID": "BJ21xK9q", "value": "cash"},{"fieldID": "ryghJxtqc", "value": "cash"},{"fieldID": "rkbhyxtq5", "value": "cash"}]};
			if(_.difference(forms[demo.formID].fields, _.map(demo.fields, 'fieldID')).length > 0){
				return resolve();
			}
			var a = JSON.stringify({"forms": forms, "fields": fields, "submissions": submissions}, null, "\t");
			if(dbQueue.queue.length == 0){
				console.log("RATE: (per ms)", queueCount / (new Date()-start));
			}
			return resolve();
		})
	});
}
//END BENCHMARK