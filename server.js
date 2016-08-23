console.log("Formie Server v1");
var express = require('express');
var webServer = express();
var fs = require("fs");
var database = "db.json";
var bodyParser = require('body-parser');
var morgan = require('morgan');
var shortid = require('shortid');
var _ = require('lodash');


for(var i=0; i<0; i++){
	console.log(shortid.generate());
}

var forms;

webServer.use(morgan("-----------\\n:method  :url\\n-----------\\nRES-TIME: :response-time ms\\nREMOTE-ADDRESS: :remote-addr\\n-----------\\n\\n"));
webServer.use(bodyParser.urlencoded({ extended: false }));
webServer.use(bodyParser.json());

reloadDatabase(function(){
	console.log(database + " loaded");
		webServer.listen(3000, function () {
		console.log('HTTP server listening on port 3000!');
	});
});

function saveDatabase(callback){
	fs.writeFile(database, JSON.stringify({"forms": forms}, null, "\t"), "utf8", callback);
}

function reloadDatabase(callback){
	var source = require("./"+database);
	forms = source.forms;
	callback();
}

webServer.get('/homepage', function(req, res) {
	var build = {};
	for(var formKey in forms){
		build[formKey] = {name: forms[formKey].name};
	}
	res.send(build);
});

webServer.get('/form/get/:id', function(req, res) {
	var form = _.pick(forms[req.params.id], ['name', 'fields']);
	res.send(form);
});

webServer.post('/form/new', function(req, res) {
	var form = req.body.form;
	form.submissions = [];
	forms[shortid.generate()] = form;
	res.send();
	saveDatabase();
});

webServer.post('/form/submit', function(req, res) {
	forms[req.body.formID].submissions[forms[req.body.formID].submissions.length] = req.body.submission;
	res.send();
	saveDatabase();
});

webServer.use(express.static('static'));
