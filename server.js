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


var FieldSchema = new Schema({
	type: {type: String, enum: ['number', 'text']},
	name: String,
	helper: String,
	required: Boolean
});
var FormSchema = new Schema({
	name: String,
	created: {type: Date, default: Date.now},
	enabled: {type: Boolean, default: true},
	fields: [Schema.Types.ObjectId]
});


mongoose.model('Form', FormSchema); 
mongoose.model('Field', FieldSchema); 
var Form = mongoose.model('Form');
var Field = mongoose.model('Field');

var webServer = express();

webServer.use(morgan("-----------\\n:method  :url\\n-----------\\nRES-TIME: :response-time ms\\nREMOTE-ADDRESS: :remote-addr\\n-----------\\n\\n"));
webServer.use(bodyParser.urlencoded({ extended: false }));
webServer.use(bodyParser.json());

webServer.listen(port, function () {
	console.log('HTTP server listening on port ' + port + '!');
});

webServer.get('/test', function(req, res) {
	Field.findById("57f26beb9071fd00dd16475c")
	.then(field => {
		res.send(field);
		console.log(field);
	})
	.catch(e => {
		console.log('mongo error ', e);
	})
});

webServer.get('/homepage', function(req, res) {
	var build = {forms: {}, submissions: {}};
	var exec = [];
	exec.push(
		Form.find({}, "_id name").where('enabled').equals(true)
		.then(a => {
			build.forms = a;
		})
	)
	Promise.all(exec)
	.then(() => {
		res.send(build);
	});
});

webServer.get('/form/manage', function(req, res) {
	Form.find({}, "_id enabled created name")
	.then(a => {
		res.send(a);
	})
});

webServer.get('/form/get/:id', function(req, response) {
	var result = {};
	var exec = [];
	exec.push(
		Form.find({}, "_id name type helper required").where('enabled').equals(true)
		.then(a => {
			build.forms = a;
		})
	)
	Promise.all(exec)
	.then(() => {
		res.send(build);
	});
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

	//maybe check if form name in use already?

	//insert form and fields into database
	Field.create(req.body.fields)
	.then(a => {
		return Form.create({name: req.body.name, fields: _.map(a, '_id')});
	})
	.then(() => {
		response.send("ok");
		console.log("Form inserted");
	})
	.catch(e => {
		console.log('mongo error', e);
	})
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
