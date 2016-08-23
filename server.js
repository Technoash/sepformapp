console.log("Formie Server v1");
var express = require('express');
var webServer = express();
var fs = require("fs");
var database = "db.json";
var bodyParser = require('body-parser')

var forms;

reloadDatabase(function(){
	console.log(database + " loaded");
		webServer.listen(3000, function () {
		console.log('HTTP server listening on port 3000!');
	});
});
-
function saveDatabase(callback){
	fs.writeFile(database, JSON.stringify({"forms": forms}, null, "\t"), "utf8", callback);
}

function reloadDatabase(callback){
	var source = require("./"+database);
	forms = source.forms;
	callback();
}


webServer.get('/formlist', function (req, res) {
	var build = {};
	for(var formKey in forms){
		build[formKey] = {name: forms[formKey].name};
	}
	logRequest("Formlist", build);
	res.send(build);
});

webServer.get('/getForm/:id', function (req, res) {
	var body = forms[req.params.id];
	logRequest("Form "+ req.params.id, body);
	res.send(forms[req.params.id]);
});

webServer.post('/newForm', function (req, res) {
	console.log(req.body);
	var body = forms[req.params.id];
	logRequest("New form submission "+ req.params.id, body);
	res.send(forms[req.params.id]);
});

var requestID = 0;
function logRequest(name, data){
	console.log("------------------");
	console.log(requestID + ": Request for " + name);
	console.log("------------------");
	console.log(JSON.stringify(data, null, 2));
	console.log("------------------");
	requestID +=1;
}

webServer.use(express.static('static'));
webServer.use(bodyParser.json()); // support json encoded bodies
webServer.use(bodyParser.urlencoded({extended: true})); // support encoded bodies


