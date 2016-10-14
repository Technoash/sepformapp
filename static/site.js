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
	.when('/user', {
		templateUrl : 'pages/home.html',
		controller  : 'HomeController',
		data: {
			access: 'user'
		}
	})
	.when('/manager', {
		templateUrl : 'pages/formManage.html',
		controller  : 'FormManageController',
		data: {
			access: 'manager'
		}
	})
	.when('/form/edit/:id', {
		templateUrl : 'pages/formEdit.html',
		controller  : 'FormEditController',
		data: {
			access: 'user',
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
		controller  : 'FormFillController',
		data: {
			access: 'user',
			state: 'new'
		}
	})
	.when('/submission/fill/:submissionID', {
		templateUrl : 'pages/submission.html',
		controller  : 'FormFillController',
		data: {
			access: 'user',
			state: 'edit'
		}
	})
	.when('/submission/view/:submissionID', {
		templateUrl : 'pages/submission.html',
		controller  : 'FormFillController',
		data: {
			access: 'user',
			state: 'view'
		}
	})
	.when('/somerandompage', {
		templateUrl : 'pages/viewSubmissionEdit.html'
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
		text: "Text"
		//number: "Number",
		//date: "Date",
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


myApp.controller('FormManageController', function($scope, $request) {
	$scope.formsList = {};

	$scope.loadFormList = function(){
		$request.get('/form/manage').then(function(res){
			$scope.formsList = res.data;
			$scope.$apply();
		});
	}

	$scope.loadFormList();
});

myApp.controller('FormFillController', function($scope, $request, $routeParams, $location, $session, $route) {
	$scope.state = $route.current.$$route.data.state;
	$scope.form = {_id: $routeParams.formID};
	$scope.fields = {};
	$scope.values = [];

	$scope.loadForm = function(){
		$request.get('/form/get/'+$scope.form._id)
		.then(function(res){
			$scope.form = res.data.form;
			$scope.fields = res.data.fields;
			for(var i = 0; i < $scope.fields.length; i++) $scope.values.push({value: "", fieldID: $scope.fields[i]._id});
			$scope.$apply();
		});
	}

	$scope.valueByID = function(id){
		for(var i = 0; i < $scope.values.length; i++){
			if($scope.values[i].fieldID == id){
				return $scope.values[i];
			}
		}
	}

	$scope.submitForm = function(saved){
		$request.post('/form/submission/new', {form: $scope.form._id, values: $scope.values, saved: saved})
		.then(function(res){
			$location.path("/user");
			$scope.$apply();
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
			if($location.path() == "/") $location.path('/'+$rootScope.auth.account.access);
			else $route.reload();
		});
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