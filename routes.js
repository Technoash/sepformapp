var _ = require('lodash');
var inspector = require('schema-inspector');
var Promise = require("bluebird");
var password = require('password-hash-and-salt-promise');

// RESPONSE HTTP STATUSES
//  200 - good
//  400 - user error, business logic error
//  500 - unexpected server error, or unxepexted JSON format
//  401 - need to log in

// RESPONSE CONTENT
//   if data was requested, respnond with the data object
//   if an action was requested, respond with a string describing the result "Account was created"
//   in the case of an error, describe the error "Internal error", "Account doesn't exist"

module.exports = function (webServer, mongoose) {
	var Form = mongoose.model('Form');
	var Field = mongoose.model('Field');
	var Account = mongoose.model('Account');
	var Session = mongoose.model('Session');
	var Submission = mongoose.model('Submission');
	var Notification = mongoose.model('Notification');


	//turns this: [{_id: "nejktg80f341uono3", name: "ashneil", city: "Sydney"}]
	//to this: {nejktg80f341uono3: {name: "ashneil", city: "Sydney"}}
	//makes targeting object in angular easier
	function flatten(array, fields){
		var out = {};
		if(fields){
			for(var i = 0; i < array.length; i++){
				out[array[i]._id] = _.pick(array[i], fields);
			}
			return out;
		}
		for(var i = 0; i < array.length; i++){
			out[array[i]._id] = _.omit(array[i].toJSON(), "_id");
		}
		return out;
	}

	function filter(array, fields){
		var out = [];
		for(var i = 0; i < array.length; i++){
			out.push(_.pick(array[i], fields));
		}
		return out
	}

	//express middleware: checks if session cookie is valid, updates account cookie, verifies access permission
	function validateAccess(access){
		return function(req, res, next){
			if(typeof req.session.sessionID === 'undefined'){
				res.status(401).send('No cookie');
				return;
			}

			function AuthError(clientMessage) {
				this.clientMessage = clientMessage;
			}
			AuthError.prototype = Object.create(Error.prototype);

			var session;
			//find session with id from cookie
			Session.findOne().where('_id').equals(req.session.sessionID)
			.then(result => {
				//if session dosen't exist in db
				if(result == null) throw new AuthError('No session');
				session = result;
				if(Date.now() > session.endTime){
					//you have to do .then() to insert it into a promise chain for it to execute
					Session.remove({ _id: session._id }).then();
					throw new AuthError('Session expired');
				}
				//get account from session
				return Account.findOne().where('_id').equals(session.account);
			})
			.then(result => {
				if(result == null) throw new AuthError('Account dosen\'t exist');
				var account = result;
				if(account.access == access || account.access == 'manager'){
					req.session.account = account;
					return next();
				}
				throw new AuthError('Not privelleged enough');
			})
			.catch(AuthError, e => {
				res.status(401).send(e.clientMessage);
			})
			.catch(e => {
				res.status(500).send('Internal error');
				throw e;
			})
		}
	}




	webServer.get('/test', function(req, res) {
		Form.find({})
		.then(a => {
			res.status(200).send(flatten(a, ['name']));
		})
		
	});
	webServer.get('/test2', function(req, res) {
		res.status(200).send();
	});
	webServer.get('/test3', function(req, res) {
		res.status(400).send();
	});


	webServer.get('/createInitialAccount', function(req, res) {
		password('kmonney69').hash()
		.then(hash => {
			return Account.create({email: "manager@gmail.com", name: "Manager Roy", password: hash, cid: "98126016", access: "manager"});
		})
		.then(() => {
			res.send('account created');
		})
		.catch(e => {
			res.status(500).send('error');
			throw e;
		})
	});
	webServer.get('/createInitialAccount2', function(req, res) {
		password('kmonney69').hash()
		.then(hash => {
			return Account.create({email: "manager2@gmail.com", name: "Manager2 Roy", password: hash, cid: "98126016", access: "manager"});
		})
		.then(() => {
			res.send('account created');
		})
		.catch(e => {
			res.status(500).send('error');
			throw e;
		})
	});
	webServer.get('/createInitialAccountUser', function(req, res) {
		password('kmonney69').hash()
		.then(hash => {
			return Account.create({email: "user@gmail.com", name: "User Roy", password: hash, cid: "98126016", access: "user"});
		})
		.then(() => {
			res.send('account created');
		})
		.catch(e => {
			res.status(500).send('error');
			throw e;
		})
	});

	webServer.get('/auth/check', validateAccess('user'), function(req, res) {
		res.send({account: _.pick(req.session.account, ['_id', 'email', 'name', 'cid', 'access'])});
	});

	webServer.post('/auth/logout', function(req, res) {
		Session.remove({ _id: req.session.sessionID })
		.then(() => {
			req.session.destroy();
			res.send("Logged out");
		})
		.catch(e => {
			res.status(500).send("Internal error. Logout may have failed");
		});
	});

	webServer.post('/auth/login', function(req, res) {
		//validate post JSON
		var validation = inspector.validate({
			type: 'object',
			properties: {
				email: {type: "string"},
				password: {type: "string"},
				remember: {type: "boolean"}
			}
		}, req.body);

		if(!validation.valid) return res.status(500).send("request validation failed.");
		
		function LoginError(clientMessage) {
			this.clientMessage = clientMessage;
		}
		LoginError.prototype = Object.create(Error.prototype);

		//get account
		var account;
		Account.find().where('email').equals(req.body.email.toLowerCase())
		.then(result => {
			if(result.length != 1) throw new LoginError('Account not found');
			account = result[0];
			//check password
			return password(req.body.password).verifyAgainst(account.password);
		})
		.then(passAccepted => {
			if(!passAccepted) throw new LoginError('Password incorrect');
			//delete any existing sessions for this account
			return Session.remove({ account: account._id });
		})
		.then(() => {
			//create a new session
			//var endTime = Date.now() + 2*60*60*1000
			var endTime = Date.now() + 500*1000;
			//   if remember me, add 6 hours
			//if(req.body.remember) endTime += 6*60*60*1000
			return Session.create({account: account._id, endTime: endTime, remember: req.body.remember})
		})
		.then(newSession => {
			//set cookie and send account information
			req.session.sessionID = newSession._id;
			res.send({account: _.pick(account, ['_id', 'email', 'name', 'cid', 'access']), session: {expiresIn: newSession.endTime - Date.now()}});
		})
		.catch(LoginError, e => {
			res.status(400).send(e.clientMessage);
		})
		.catch(e => {
			res.status(500).send("Internal error");
			throw e;
		})
	});

	webServer.get('/homepage', validateAccess('user'), function(req, res) {
		var build = {forms: {}, submissions: {}};
		var exec = [];
		exec.push(
			Form.find({}, "_id name").where('enabled').equals(true)
			.then(a => {
				build.forms = a;
			})
		)
		exec.push(
			Submission.find({account: req.session.account._id}, "_id form created state")
			.then(a => {
				build.submissions = a;
			})
		)
		Promise.all(exec)
		.then(() => {
			res.send(build);
		});
	});

	webServer.get('/form/template/get/:id', validateAccess('user'), function(req, res) {
		var form;
		//handle param undefined
		var query = Form.findOne({}, "_id name fields enabled").where('_id').equals(req.params.id)
		if(req.session.account.access == 'user') query = query.where('enabled').equals(true);
		
		function RequestError(clientMessage) {
			this.clientMessage = clientMessage;
		}
		RequestError.prototype = Object.create(Error.prototype);

		query
		.then(result => {
			if(result == null) throw new RequestError('Form doesn\'t exist');
			form = result;
			return Field.find().where('_id').in(form.fields)
		})
		.then(result => {
			res.send({form: _.pick(form, ['_id', 'name']), fields: filter(result, ['_id', 'type', 'name', 'helper', 'required'])});
		})
		.catch(RequestError, e => {
			res.status(400).send(e.clientMessage);
		})
		.catch(e =>{
			res.status(500).send("Internal error");
			throw e;
		})
	});

	webServer.get('/form/submission/get/:id', validateAccess('user'), function(req, res) {
		//handle param undefined

		function NotFound(clientMessage) {
			this.clientMessage = clientMessage;
		}
		NotFound.prototype = Object.create(Error.prototype);


		var formManager = false;
		var submission, form, fields, notifications, accounts;

		Submission.findOne().where('_id').equals(req.params.id)
		.then(a=>{
			if(a == null) throw new NotFound('Submission not found 1');
			submission = a;

			return Form.findOne().where('_id').equals(submission.form)
		})
		.then(a=>{
			if(a == null) throw new NotFound('Submission not found 2');
			form = a;

			//ensure that user either made the submission OR is a manager of the form
			if(typeof _.find(form.managers, function(manager) { return manager.equals(req.session.account._id); }) !== 'undefined') formManager = true;
			if(!submission.account.equals(req.session.account._id) && !formManager){
				throw new NotFound('Submission not found 3')
			}
			return Field.find().where('_id').in(form.fields)
		})
		.then(a=>{
			fields = a;
			//get notifications for submission
			var type = ['comment', 'accepted', 'declined', 'returned', 'submitted'];
			//don't send private manager comments if not manager of this form
			if(formManager) type.push('comment_manager');
			return Notification.find().where('submission').equals(submission._id).where('type').in(type);
		})
		.then(a=>{
			notifications = a;
			//get relevant accounts
			var accountlist = [submission.account];
			accountlist = accountlist.concat(form.managers);
			return Account.find({}, "_id email cid name").where('_id').in(accountlist);
		})
		.then(a=>{
			accounts = a;
			res.send({form: form, fields: fields, submission: submission, notifications: notifications, accounts: accounts});
		})
		.catch(NotFound, e => {
			res.status(400).send(e.clientMessage);
		})
		.catch(e =>{
			res.status(500).send("Internal error");
			throw e;
		})
	});

	webServer.post('/form/submission/state/update', validateAccess('manager'), function(req, res) {
		//handle param undefined
		var validation = inspector.validate({
			type: 'object',
			properties: {
				submissionID: {type: "string"},
				state: {type: "string"},
				content: {type: "string", optional: true}
			}
		}, req.body);

		if(!validation.valid) return res.status(500).send("request validation failed.");
		if(typeof _.find(['comment', 'comment_manager', 'submitted', 'accepted', 'declined', 'returned', 'reverted'], function(state) { return state == req.body.state; }) === 'undefined') return res.status(500).send("request validation failed."); 

		function NotFound(clientMessage) {
			this.clientMessage = clientMessage;
		}
		NotFound.prototype = Object.create(Error.prototype);

		var submission, form;
		Submission.findOne().where('_id').equals(req.body.submissionID)
		.then(a=>{
			if(a == null) throw new NotFound('Submission not found1');
			submission = a;

			return Form.findOne().where('_id').equals(submission.form).where('managers').equals(req.session.account._id)
		})
		.then(a=>{
			if(a == null) throw new NotFound('Submission not found2');
			form = a;
			var tmpState = req.body.state;
			if(tmpState == 'reverted') tmpState = 'saved';
			if(tmpState != 'comment' && tmpState != 'comment_manager') return submission.update({state: tmpState});
		})
		.then(()=>{
			console.log(req.body);
			var notificationData = {submission: submission._id, author: req.session.account._id, type: req.body.state};
			if(req.body.state == 'comment' || req.body.state == 'comment_manager') notificationData['comment_content'] = req.body.content;
			return Notification.create(notificationData);
		})
		.then((notification)=>{
			res.send(notification);
		})
		.catch(NotFound, e => {
			res.status(400).send(e.clientMessage);
		})
		.catch(e =>{
			res.status(500).send("Internal error");
			throw e;
		})
	});




	webServer.post('/form/submission/new', validateAccess('user'), function(req, res) {
		var validation = inspector.validate({
			type: 'object',
			properties: {
				form: {
					type: 'string',
				},
				values: {
					type: "array",
					items: {
						type: "object",
						properties: {
							value: {type: "string"},
							fieldID: {type: "string"}
						}
					}
				},
				saved: {
					type: 'boolean'
				},
				submissionID: {
					type: 'string',
					optional: true
				}
			}
		}, req.body);
		if(!validation.valid) return res.status(500).send("request validation failed.");
		///return res.send('good');

		function NotFound(clientMessage) {
			this.clientMessage = clientMessage;
		}
		NotFound.prototype = Object.create(Error.prototype);

		function ValidationError(clientMessage) {
			this.clientMessage = clientMessage;
		}
		ValidationError.prototype = Object.create(Error.prototype);

		var form;
		Form.findOne( { _id: req.body.form})
		.then(result => {
			if(result == null) throw new NotFound('Form not found');
			form = result;
			//can be reused
			return Field.find().where('_id').in(form.fields);

		})
		.then(fields => {

			if(!req.body.saved){
				//ensure all required fields exist
				for(var i = 0; i < fields.length; i++){
					var found = false;
					for(var a = 0; a < req.body.values.length; a++){
						///need to check for validity of each type here; right now just checking if string is empty
						if(fields[i]._id == req.body.values[a].fieldID ){
							if(fields[i].type == "text" && (!fields[i].required || req.body.values[a].value != "")){
								found = true;
								break;
							}
							if(fields[i].type == "date" && (!fields[i].required || req.body.values[a].value != "")){
								found = true;
								break;
							}
						};
					}
					if(!found) throw new ValidationError("One or more required fields not provided");
				}
			}

			//make sure all the request fields are fields in the database
			for(var a = 0; a < req.body.values.length; a++){
				var found = false;
				for(var i = 0; i < fields.length; i++){
					if(fields[i]._id == req.body.values[a].fieldID) {
						found = true;
						break;
					}
				}
				if(!found) throw new ValidationError("One or more fields not found");
			}

			
			if(typeof req.body.submissionID === 'undefined') 
				return Submission.create({account: req.session.account._id, form: req.body.form, values: req.body.values, state: (req.body.saved) ? 'saved' : 'submitted'});

			return Submission.find().where('account').equals(req.session.account._id).where('_id').equals(req.body.submissionID).
			update({values: req.body.values, created: Date.now(), state: (req.body.saved) ? 'saved' : 'submitted'})
		})
		.then((result) => {
			var submissionID = result._id;
			if(typeof req.body.submissionID !== 'undefined'){
				submissionID = req.body.submissionID;
			}
			if(!req.body.saved) return Notification.create({submission: submissionID, author: req.session.account._id, type: 'submitted'});
		})
		.then(()=>{
			res.send('submitted');
		})
		.catch(NotFound, e => {
			res.status(400).send(e.clientMessage);
		})
		.catch(ValidationError, e => {
			res.status(400).send(e.clientMessage);
		})
		.catch(e =>{
			res.status(500).send("Internal error");
			throw e;
		})
	});

	webServer.get('/manager/homepage', validateAccess('manager'), function(req, res) {
		var build = {forms: [], accounts: []};
		var exec = [];
		exec.push(
			Form.find({}, "_id name").where('managers').equals(req.session.account._id)
			.then(a => {
				build.forms = a;
			})
		);
		exec.push(
			Account.find({}, "_id name cid email access")
			.then(a => {
				build.accounts = a;
			})
		);
		Promise.all(exec)
		.then(() => {
			res.send(build);
		});
	});

	webServer.get('/manager/form/get/:id', validateAccess('manager'), function(req, res) {
		var build = {form: {}, submissions: []};

		function NotFound(clientMessage) {
			this.clientMessage = clientMessage;
		}
		NotFound.prototype = Object.create(Error.prototype);

		Form.findOne().where('managers').equals(req.session.account._id).where('_id').equals(req.params.id)
		.then(a => {
			if(a === null) throw new NotFound('Form not found');
			build.form = a;
		})
		.then(()=>{
			return Submission.find({}, "_id created state form account").where('form').equals(build.form._id);
		})
		.then(a => {
			build.submissions = a;
		})
		.then(() => {
			res.send(build);
		})
		.catch(NotFound, e=>{
			res.status(400).send(e.clientMessage);
		});
	});


	webServer.post('/manager/form/manager/remove', validateAccess('manager'), function(req, res) {
		var validation = {
			type: 'object',
			properties: {
				formID: {
					type: 'string'
				},
				accountID: {
					type: "string"
				}
			}
		};
		if(!inspector.validate(validation, req.body)) return response.status(500).send("request validation failed.");


		function NotFound(clientMessage) {
			this.clientMessage = clientMessage;
		}
		NotFound.prototype = Object.create(Error.prototype);
		function BusinessError(clientMessage) {
			this.clientMessage = clientMessage;
		}
		BusinessError.prototype = Object.create(Error.prototype);

		var form;
		//ensure that the requester is a manager for this form
		Form.findOne().where('_id').equals(req.body.formID).where('managers').equals(req.session.account._id)
		.then(a=>{
			if(a === null) throw new NotFound('Form not found');
			form = a;
			//always have at least one manager
			if(form.managers.length < 2) throw new BusinessError('Can not remove the last manager of a form');

			//do the update
			return form.update({$pull: {managers: req.body.accountID}});
		})
		.then(()=>{
			res.send('Manager removed');
		})
		.catch(NotFound, (e)=>{
			res.status(400).send(e.clientMessage);
		})
		.catch(BusinessError, (e)=>{
			res.status(400).send(e.clientMessage);
		})
	});


	webServer.post('/manager/form/manager/add', validateAccess('manager'), function(req, res) {
		var validation = {
			type: 'object',
			properties: {
				formID: {
					type: 'string'
				},
				accountID: {
					type: "string"
				}
			}
		};
		if(!inspector.validate(validation, req.body)) return response.status(500).send("request validation failed.");


		function NotFound(clientMessage) {
			this.clientMessage = clientMessage;
		}
		NotFound.prototype = Object.create(Error.prototype);
		function BusinessError(clientMessage) {
			this.clientMessage = clientMessage;
		}
		BusinessError.prototype = Object.create(Error.prototype);
		var form;
		//ensure that the requester is a manager for this form
		Form.findOne().where('_id').equals(req.body.formID).where('managers').equals(req.session.account._id)
		.then(a=>{
			if(a === null) throw new NotFound('Form not found');
			form = a;

			//ensure that the account is a manager
			return Account.findOne().where('_id').equals(req.body.accountID);
		})
		.then(a=>{
			if(a === null) throw new NotFound('Account not found');

			if(a.access != 'manager') throw new BusinessError('Account is not a manager');

			//do the update
			return form.update({$push: {managers: req.body.accountID}});
		})
		.then(()=>{
			res.send('Manager added');
		})
		.catch(NotFound, (e)=>{
			res.status(400).send(e.clientMessage);
		})
		.catch(BusinessError, (e)=>{
			res.status(400).send(e.clientMessage);
		})
	});


	webServer.post('/form/new', validateAccess('manager'), function(req, response) {
		var validation = {
			type: 'object',
			properties: {
				form: {
					type: 'object',
					properties: {
						name: {type: "string"}
					}
				},
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
		if(!inspector.validate(validation, req.body)) return response.status(500).send("request validation failed.");

		//validate field types
		for(var i=0; i < req.body.fields.length; i++){
			if(!(req.body.fields[i].type == "text" || req.body.fields[i].type == "date")) return response.status(500).send("request validation failed.");
		}

		//maybe check if form name in use already?

		//insert form and fields into database
		Field.create(req.body.fields)
		.then(a => {
			return Form.create({name: req.body.form.name, fields: _.map(a, '_id'), managers: [req.session.account._id]});
		})
		.then(() => {
			response.send("ok");
			console.log("Form inserted");
		})
		.catch(e => {
			console.log('mongo error', e);
		})
	});
};

