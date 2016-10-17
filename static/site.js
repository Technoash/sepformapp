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