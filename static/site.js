var myApp = angular.module('myApp', ['ngRoute', 'ui.bootstrap']).run(function($rootScope){
	$rootScope.auth = {unchecked: true};
	toastr.options = {
		"positionClass": "toast-bottom-right"
	}
});

myApp.config(function($routeProvider) {
	$routeProvider
	.when('/', {
		templateUrl : 'pages/landing.html'
	})
	.when('/account/new/', {
		templateUrl : 'pages/createAccount.html',
		controller : 'CreateAccountController'
	})
	.when('/user', {
		templateUrl : 'pages/home.html',
		controller  : 'HomeController',
		data: {
			access: 'user'
		}
	})
	.when('/manager', {
		templateUrl : 'pages/managerHome.html',
		controller  : 'ManagerHomeController',
		data: {
			access: 'manager'
		}
	})
	.when('/form/edit/:id', {
		templateUrl : 'pages/formEdit.html',
		controller  : 'FormEditController',
		data: {
			access: 'manager',
			new: false
		}
	})
	.when('/form/new', {
		templateUrl : 'pages/formEdit.html',
		controller  : 'FormEditController',
		data: {
			access: 'manager',
			new: true
		}
	})
	.when('/form/fill/:formID', {
		templateUrl : 'pages/submission.html',
		controller  : 'SubmissionController',
		data: {
			access: 'user',
			state: 'new'
		}
	})
	.when('/submission/fill/:submissionID', {
		templateUrl : 'pages/submission.html',
		controller  : 'SubmissionController',
		data: {
			access: 'user',
			state: 'incomplete'
		}
	})
	.when('/submission/view/:submissionID', {
		templateUrl : 'pages/submission.html',
		controller  : 'SubmissionController',
		data: {
			access: 'user',
			state: 'view'
		}
	})
	.otherwise({
		templateUrl : 'pages/notFound.html'
	})
});

myApp.controller('FormEditController', function($scope, $request, $location, $route, $alert) {
	$scope.new = $route.current.$$route.data.new;
	$scope.form = {};
	$scope.form.name = "";
	$scope.fields = [];

	$scope.fieldTypes = {
		text: "Text",
		//number: "Number",
		date: "Date"
		//time: "Time"
	}

	$scope.index_count = 0

	$scope.fieldSelected = null;

	$scope.addField = function(type) {
		$scope.fieldSelected = $scope.fields[$scope.fields.length] = {
			type: type,
			name: "",
			helper: "",
			required: false
		}	
	}
	$scope.displayField = function(index) {
		if(index < $scope.fields.length) $scope.fieldSelected = $scope.fields[index]
	}
	$scope.deleteField = function(index){
		if ($scope.fields[index] == $scope.fieldSelected) $scope.fieldSelected = null;
		$scope.fields.splice(index, 1);
	}
	$scope.submitNewForm = function(){
		$request.post('/form/new', {fields: $scope.fields, form: $scope.form})
		.then(function(res){
			$location.path( "/manager" );
			$alert.success('Form created');
			$scope.$apply();
		});
		///handle error
	}
	$scope.updateForm = function(){
		alert('not implemented');
	}
});

myApp.controller('HomeController', function($scope, $request, $misc) {
	$scope.forms = {};
	$scope.submissions = {};
	$scope.$misc = $misc;

	$scope.loadFormList = function(){
		$request.get('/homepage').then(function(res){
			$scope.forms = res.data.forms;
			$scope.submissions = res.data.submissions;
			$scope.$apply();
		});
	}

	$scope.loadFormList();
});


myApp.controller('ManagerHomeController', function($scope, $request, $misc, $alert, $rootScope) {
	$scope.$misc = $misc;

	$scope.selectedFormID = null;
	$scope.selectedForm = null;
	$scope.selectedFormSubmissions = [];

	$scope.accounts = [];
	$scope.forms = [];

	$scope.loadFormList = function(){
		$request.get('/manager/homepage').then(function(res){
			console.log(res);
			$scope.forms = res.data.forms;
			$scope.accounts = res.data.accounts;
			$scope.$apply();
		});
	}
	$scope.openForm = function(id){
		$request.get('/manager/form/get/'+id).then(function(res){
			console.log(res);
			$scope.selectedFormID = id;
			$scope.selectedForm = res.data.form;
			$scope.selectedFormSubmissions = res.data.submissions;
			$scope.$apply();
		});
	}
	$scope.closeForm = function(){
		$scope.selectedFormID = null;
		$scope.selectedForm = null;
		$scope.selectedFormSubmissions = [];
		$scope.selectedFormAccounts = [];
	}

	$scope.isAccountManager = function(id){
		return typeof _.find($scope.selectedForm.managers, function(o){
			return o == id;
		}) !== 'undefined';
	}

	$scope.toggleManager = function(id){
		console.log(_);
		if($scope.isAccountManager(id)){
			//remove
			if($scope.selectedForm.managers.length == 1) return $alert.info('You can not remove the last manager of this form');

			$request.post('/manager/form/manager/remove', {formID: $scope.selectedFormID, accountID: id})
			.then(function(res){
				_.remove($scope.selectedForm.managers, function(managerID) {
					return managerID == id;
				});

				if(id == $rootScope.auth.account._id){
					_.remove($scope.forms, function(form) {
						return form._id == $scope.selectedFormID;
					});
					$scope.closeForm();
					$alert.success("You removed yourself as a manager");
				}
				else $alert.success("Manager removed from form");
				$scope.$apply();
			});
		}
		else{
			//add
			$request.post('/manager/form/manager/add', {formID: $scope.selectedFormID, accountID: id})
			.then(function(res){
				$scope.selectedForm.managers.push(id);
				$scope.$apply();
				$alert.success("Manager added to form");
			});
		}
	}

	$scope.loadFormList();
});


myApp.controller('SubmissionController', function($scope, $request, $routeParams, $location, $route, $alert, $misc, $rootScope) {
	//new, incomplete, view
	$scope.$rootScope = $rootScope;
	$scope.$misc = $misc;
	$scope.state = $route.current.$$route.data.state;
	$scope.form = {};
	$scope.fields = [];
	$scope.submission = {values: []};
	$scope.notifications = [];
	$scope.accounts = [];
	$scope.comment = {content: ""};
	$scope.valueErrors = {};

	$scope.loadForm = function(){
		if($scope.state == 'new') {
			$request.get('/form/template/get/'+$routeParams.formID)
			.then(function(res){
				$scope.form = res.data.form;
				$scope.fields = res.data.fields;
				for(var i = 0; i < $scope.fields.length; i++) $scope.submission.values.push({value: "", fieldID: $scope.fields[i]._id});
				$scope.$apply();
			});
		}
		if($scope.state == 'incomplete' || $scope.state == 'view') {
			$request.get('/form/submission/get/'+$routeParams.submissionID)
			.then(function(res){
				/// submission, form, fields, notifications, accounts
				$scope.form = res.data.form;
				$scope.fields = res.data.fields;
				$scope.submission = res.data.submission;
				$scope.notifications = res.data.notifications;
				$scope.accounts = res.data.accounts;
				$scope.$apply();
				$scope.commentScrollBottom();
			});
		}
	}

	$scope.whoAmI = function(){
		if(typeof _.find($scope.form.managers, function(o){
			return o == $rootScope.auth.account._id;
		}) !== 'undefined')
			return 'manager';
		return 'user';
	}

	$scope.isEditable = function(){
		return $scope.state == 'new' || $rootScope.auth.account._id == $scope.submission.account && ($scope.submission.state == 'saved' || $scope.submission.state == 'returned')
	}

	$scope.valueByID = function(id){
		for(var i = 0; i < $scope.submission.values.length; i++){
			if($scope.submission.values[i].fieldID == id){
				return $scope.submission.values[i];
			}
		}
	}

	$scope.submitForm = function(saved){
		$scope.valueErrors = {};
		for(var i = 0; i < $scope.fields.length; i++){
			var field = $scope.fields[i];
			if(field.type == "text" && field.required && $scope.valueByID(field._id).value == "") $scope.valueErrors[field._id] = field.name + " is required and cannot be empty";
			if(field.type == "date" && field.required && $scope.valueByID(field._id).value == "") $scope.valueErrors[field._id] = field.name + " is required and cannot be empty";
		}

		if(!saved && _.size($scope.valueErrors) > 0) return $alert.warning('Some fields in your submission are not valid');

		var tosend = {form: $scope.form._id, values: $scope.submission.values, saved: saved};

		if($scope.state == 'incomplete' || $scope.state == 'view') tosend['submissionID'] = $routeParams.submissionID;
		$request.post('/form/submission/new', tosend)
		.then(function(res){
			if(saved) $location.path("/user");
			if(!saved){
				$location.path("/submission/view/" + res.data);
				if($scope.submission._id == res.data) $route.reload();
			}
			$alert.success('Submission ' + ((saved) ? 'saved':'created'));
			$scope.$apply();
		})
	}

	$scope.commentScrollBottom = function(){
		var elem = document.getElementById('commentBoxScrollContainer');
  		elem.scrollTop = elem.scrollHeight;
	}

	$scope.updateState = function(newState){
		var reqData = {submissionID: $routeParams.submissionID, state: newState};
		if(newState == 'comment' || newState == 'comment_manager'){
			reqData['content'] = $scope.comment.content;
			console.log('comment', $scope.comment.content);
		}
		$request.post('/form/submission/state/update', reqData)
		.then(function(res){
			if(newState != 'comment' && newState != 'comment_manager'){
				$scope.submission.state = newState;
				$alert.success("State of form changed");
			}
			else{
				//comment
				$alert.success("Comment added");
			}
			$scope.notifications.push(res.data);
			$scope.$apply();
			$scope.commentScrollBottom();
		});
	}
	//handle err
	$scope.loadForm();
});

myApp.directive( 'goClick', function($location) {
  return function ( scope, element, attrs ) {
    var path;
    attrs.$observe( 'goClick', function(val) {
    	path = val;
    });
    element.bind( 'click', function() {
		scope.$apply( function() {
			$location.path(path);
		});
	});
  };
});

myApp.run(function($rootScope, $location, $http, $uibModal, $route, $alert, $session) {
	$rootScope.$on('$routeChangeStart', function (event, toState, toParams) {

		if($rootScope.auth.unchecked){
			event.preventDefault();
			$rootScope.auth.unchecked = false;
			//site just loaded. need to check if a valid cookie exists
			
			$http.get('/auth/check')
			.then(function(res){
				//server says I have a valid cookie and session. account details in res
				$rootScope.auth.account = res.data.account;
				$alert.info("Logged in as <i>" + $rootScope.auth.account.email + "</i>");
				$route.reload();
			})
			.catch(function(){
				$route.reload();
			});
			return;
		}

		//continue if page doesn't have access property
		if(typeof toState === 'undefined') return;
		if(typeof toState.data === 'undefined') return;
		if(typeof toState.data.access === 'undefined') return;

		var access = toState.data.access;
		if (!$session.loggedIn()){
			console.log('preventing', toState.originalPath);
			event.preventDefault();

			$alert.info("Please log in");
			$session.loginModal().result
			.then(function(){
				$route.reload();
			});
			return;
		}
		if($session.loggedIn() && access != $rootScope.auth.account.access && $rootScope.auth.account.access != 'manager'){
			$alert.error("You are not authorised to access this page");
			event.preventDefault();
			return;
		}
	});

});

myApp.controller('mainController', function($scope, $rootScope, $http, $alert, $location, $session, $route) {
	$scope.root = $rootScope;
	$scope.$session = $session;

	$scope.logOut = function(){
		$http.post('/auth/logout')
		.then(function(){
			var email = null;
			if($session.loggedIn()) email = $rootScope.auth.account.email;
			$session.logOut();
			$location.path('/');
			if(email) $alert.success('<i>' + email + '</i> has been logged out');
			else $alert.success('You have been logged out');
		})
		.catch(function(e){
			console.log(e);
			$alert.error('Unable to completely log out');
		});
	}

	$scope.logIn = function(){
		$session.loginModal().result
		.then(function(){
			if($location.path() == "/")
			 $location.path('/'+$rootScope.auth.account.access);
			else $route.reload();
		});
	}
});

myApp.controller('CreateAccountController', function($scope, $request, $location, $route, $alert) {
	$scope.firstName = '';
	$scope.lastName = '';
	$scope.email = '';
	$scope.password = '';
	$scope.alert = null;

	$scope.accountType = {
        name: 'manager'
    };

	$scope.isEmptyOrSpaces = function(str) {
		return str === null || str.match(/^ *$/) !== null;
	};

	$scope.register = function(){
		/*if ($scope.isEmptyOrSpaces($scope.email) || $scope.isEmptyOrSpaces($scope.password))
		{
			$scope.registerMessage('Email or password cannot be empty');
			return;
		}*/
		$request.post('/auth/register', {email: $scope.email, password: $scope.password, firstName: $scope.firstName, lastName: $scope.lastName, accountType: $scope.accountType.name})
		.then(function(e){
			$scope.registerMessage("Registion completed!");
		})
		.catch(function(e){
			$scope.registerMessage(e.data);
		})
	};

	$scope.registerMessage = function(msg){
		$scope.alert = msg;
	}

});

function loginModalController($scope, $http, $rootScope, $uibModalInstance, alert, $alert, $session) {
	$scope.email= "";
	$scope.password= "";
	$scope.remember= true;
	$scope.helper = null;
	$scope.internal = null;

	if(typeof alert === 'undefined') $scope.alert = null;
	else $scope.alert = alert;

	if($session.loggedIn()) $scope.email = $rootScope.auth.account.email;

	$scope.login = function(){
		$scope.helper = null;
		$http.post('/auth/login', {email: $scope.email, password: $scope.password, remember: $scope.remember})
		.then(function(res){
			$rootScope.auth.account = res.data.account;
			$uibModalInstance.close('loggedin');
			$alert.success('Logged in');
		})
		.catch(function(e){
			if(e.status == 400){
				$scope.helper = e.data;
				$alert.warning('Problem logging in');
			}
			else {
				$scope.internal = {code: e.status, message: e.data};
				$alert.error('Internal problem with logging you in. Please report this');
			}
		})
	}

	$scope.registerAccount = function()
	{
		$uibModalInstance.close('loggedin');
	}

	$scope.devLoginUser = function(){
		$scope.email = "user@gmail.com";
		$scope.password = "kmonney69";
	}
	$scope.devLoginManager = function(){
		$scope.email = "manager@gmail.com";
		$scope.password = "kmonney69";
	}
}

myApp.factory('$session', function($rootScope, $uibModal, $http, $alert) {
	return {
		getAccount: function(){
			if(typeof $rootScope.auth.account !== 'undefined')
				return $rootScope.auth.account;
			return null;
		},
		loggedIn: function(){
			return typeof $rootScope.auth.account !== 'undefined' && $rootScope.auth.account;
		},
		logOut: function(){
			$rootScope.auth.account = null;
			$rootScope.auth.unchecked = false;
		},
		haveAccess: function(access){
			if(typeof $rootScope.auth.account === 'undefined' || !$rootScope.auth.account) return false;
			return access == $rootScope.auth.account.access || $rootScope.auth.account.access == 'manager';
		},
		getAccess: function(access){
			if(typeof $rootScope.auth.account === 'undefined' || !$rootScope.auth.account) return false;
			return access == $rootScope.auth.account.access;
		},
		loginModal: function(alert){
			return $uibModal.open({
			      templateUrl: 'pages/loginModal.html',
			      size: 'sm',
			      controller: loginModalController,
			      resolve: {
			      	alert: function(){
			      		return alert;
			      	}
			      }
		    });
		}
	};
});

myApp.factory('$alert', function() {
	return {
		success: function(message){
			return toastr["success"](message);
		},
		warning: function(message){
			return toastr["warning"](message);
		},
		error: function(message){
			return toastr["error"](message);
		},
		info: function(message){
			return toastr["info"](message);
		}
	};
});

myApp.factory('$misc', function() {
	return {
		filter: function(array, fields){
			var out = [];
			for(var i = 0; i < array.length; i++){
				out.push(_.pick(array[i], fields));
			}
			return out
		},
		fromID: function(id, collection){
			for(var i = 0; i < collection.length; i++){
				if(collection[i]._id == id) return collection[i];
			}
		}
	};
});

//good luck figuring this one out
myApp.factory('$request', function($http, $uibModal, $alert, $session) {
	function comb(req, resolve, reject){
		var resolved = false;

		//if the request has not resolved after one second, show a notification
		setTimeout(function(){
			if(!resolved) $alert.info('Your request is processing. Please be patient');
		}, 1000);

		req()
		.then(function(data){
			resolved = true;
			resolve(data);
		})
		.catch(function(e){
			resolved = true;
			if(e.status == 401) {
				console.log('re-login dialog');
				$alert.info("Your session has expired. Please log in again");
				$session.loginModal({title: e.data, message: "Please re-login before making this request."}).result
				.then(function(res){
					comb(req, resolve, reject);
				})
				.catch(function(){
					reject(e);
				})
				return;
			}
			reject(e);
		})
	}
	return {
		get: function(path){
			return new Promise(function(resolve, reject){
				comb(function(){return $http.get(path)}, resolve, reject);
			})
		},
		post: function(path, data){
			return new Promise(function(resolve, reject){
				comb(function(){return $http.post(path, data)}, resolve, reject);
			})
		}
	};
});

myApp.directive('accountCard', function() {
	return {
		restrict: 'A',
		templateUrl: 'pages/directiveAccountCard.html',
		scope: {
			account: '=',
		},
	};
});

myApp.filter('firstLetterUpperCase', function() {
    return function(input) {
      return (!!input) ? input.charAt(0).toUpperCase() + input.substr(1).toLowerCase() : '';
    }
});