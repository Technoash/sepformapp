var myApp = angular.module('myApp', ['ngRoute']).run(function($rootScope){
	$rootScope.auth = {};
});

myApp.config(function($routeProvider) {
	$routeProvider
	.when('/', {
		templateUrl : 'pages/home.html',
		controller  : 'HomeController',
		data: {
			access: 'user'
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
			access: 'user',
			new: true
		}
	})
	.when('/form/fill/:id', {
		templateUrl : 'pages/formFill.html',
		controller  : 'FormFillController',
		data: {
			access: 'user'
		}
	})
	.when('/form/manage', {
		templateUrl : 'pages/formManage.html',
		controller  : 'FormManageController',
		data: {
			access: 'manager'
		}
	})
	.when('/login', {
		templateUrl : 'pages/login.html',
		controller  : 'LoginController',
		data: {

		}
	});

});

myApp.controller('FormEditController', function($scope, $http, $location, $route) {
	$scope.new = $route.current.$$route.data.new;
	$scope.name = "";
	$scope.fields = [];

	$scope.addField = function(type){
		$scope.fields[$scope.fields.length] = {
			type: type,
			name: "",
			helper: "",
			required: false
		}
	}

	$scope.deleteField = function(index){
		$scope.fields.splice(index, 1);
	}

	$scope.submitNewForm = function(){
		$http.post('/form/new', {fields: $scope.fields, name: $scope.name})
		.then(function(res){
			$location.path( "/form/manage" );
		});
	}

	$scope.updateForm = function(){
		alert('not implemented');
	}
});

myApp.controller('HomeController', ['$scope', '$http', function($scope, $http) {
	$scope.formsList = {};
	$scope.submissionList = {};

	$scope.loadFormList = function(){
		$http.get('/homepage').then(function(res){
			$scope.formsList = res.data.forms;
			$scope.submissionList = res.data.submissions;
		});
	}

	$scope.loadFormList();
}]);


myApp.controller('FormManageController', ['$scope', '$http', function($scope, $http) {
	$scope.formsList = {};

	$scope.loadFormList = function(){
		$http.get('/form/manage').then(function(res){
			$scope.formsList = res.data;
		});
	}

	$scope.loadFormList();
}]);

myApp.controller('FormFillController', ['$scope', '$http', '$routeParams', '$location', function($scope, $http, $routeParams, $location) {
	$scope.form = {};
	$scope.formID = $routeParams.id;

	$scope.loadForm = function(){
		$http.get('/form/get/'+$scope.formID).then(function(res){
			$scope.form = res.data.form;
			$scope.fields = res.data.fields;
			for(var fieldID in  $scope.fields){
				$scope.fields[fieldID].value = "";
			}
		});
	}

	$scope.submitForm = function(){
		var fields = [];
		for(var fieldID in $scope.fields){
			fields.push({fieldID: fieldID, value: $scope.fields[fieldID].value});
		}
		$http.post('/form/submit', {formID: $scope.formID, fields: fields})
		.then(function(res){
			$location.path( "/" );
		});
	}
	$scope.loadForm();
}]);

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


myApp.controller('LoginController', function($scope, $http, $rootScope) {
	$scope.email= "";
	$scope.password= "";
	$scope.remember= true;

	$scope.login = function(){
		$http.post('/auth/login', {email: $scope.email, password: $scope.password, remember: $scope.remember})
		.then(function(res){
			console.log(res);
			$location.path( $rootScope.auth.returnTo );
		})
	}
});

myApp.run(function ($rootScope, $location) {

	$rootScope.$on('$routeChangeStart', function (event, toState, toParams) {
		if(typeof toState === 'undefined') return;
		if(typeof toState.data.access === 'undefined') return;

		var access = toState.data.access;

		if (typeof $rootScope.auth.currentUser === 'undefined' || 
			typeof $rootScope.auth.currentUser.access === 'undefined' || 
			access != $rootScope.auth.currentUser.access && 
			$rootScope.auth.currentUser.access != 'manager') {

			event.preventDefault();
			$rootScope.auth.returnTo = toState.originalPath;
			$location.path( "/login" );
		}
	});

});

myApp.controller('mainController', function($scope) {});

