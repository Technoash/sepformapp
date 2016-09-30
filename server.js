console.log("Formie Server v2");
console.log("WARNING: Concurrency and request validation not fully implemented");

var port = 8000;
var dbip = '';

var Promise = require("bluebird");
var express = require('express');
var fs = require("fs");
var bodyParser = require('body-parser');
var morgan = require('morgan');
var _ = require('lodash');
//for HTTP request validation
var inspector = require('schema-inspector');

var mongoose = require('mongoose');
mongoose.Promise = require('bluebird');
//for mongo database schemas
Schema = mongoose.Schema;

var db = mongoose.connect("mongodb://172.17.0.3/dev");

var FormSchema = new Schema({
	name: String,
	created: {type: Date, default: Date.now},
	enabled: {type: Boolean, default: true}
});


mongoose.model('Form', FormSchema); 
var Form = mongoose.model('Form');

var webServer = express();

webServer.use(morgan("-----------\\n:method  :url\\n-----------\\nRES-TIME: :response-time ms\\nREMOTE-ADDRESS: :remote-addr\\n-----------\\n\\n"));
webServer.use(bodyParser.urlencoded({ extended: false }));
webServer.use(bodyParser.json());

webServer.listen(port, function () {
	console.log('HTTP server listening on port ' + port + '!');
});


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
	console.log("body", req.body);
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


	Form.create({ name: req.body.name })
	.then(function(){
		console.log("form name inserted");
	})

/*
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
	});*/
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
