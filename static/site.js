var myApp = angular.module('myApp', ['ngRoute', 'ui.bootstrap']).run(function($rootScope){
	$rootScope.auth = {unchecked: true};
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


function loginModalController($scope, $http, $rootScope, $location, $uibModalInstance, $route) {
	$scope.email= "";
	$scope.password= "";
	$scope.remember= true;

	$scope.login = function(){
		$http.post('/auth/login', {email: $scope.email, password: $scope.password, remember: $scope.remember})
		.then(function(res){
			$rootScope.auth.account = res.data.account;
			$rootScope.auth.session = res.data.session;
			$route.reload();
			$uibModalInstance.close();
		})
	}
}

myApp.run(function ($rootScope, $location, $http, $uibModal, $route) {

	$rootScope.$on('$routeChangeStart', function (event, toState, toParams) {
		if(typeof toState === 'undefined') return;
		if(typeof toState.data.access === 'undefined') return;



		var access = toState.data.access;
		if (typeof $rootScope.auth.account === 'undefined'){
			//not logged in
			event.preventDefault();

			function createLoginModal(){
				return $uibModal.open({
				      templateUrl: 'pages/loginModal.html',
				      size: 'sm',
				      controller: loginModalController
			    });
			}

			if($rootScope.auth.unchecked){
				//haven't checked if cookie was set previously
				$rootScope.auth.unchecked = false;
				console.log('auth checking');
				$http.get('/auth/check')
				.then(function(res){
					$rootScope.auth.account = res.data.account;
					$rootScope.auth.session = res.data.session;
					$route.reload();
				})
				.catch(function(e){
					createLoginModal();
				})
				return;
			}
			createLoginModal();
			return;
		}
		if(access != $rootScope.auth.account.access && $rootScope.auth.account.access != 'manager'){
			alert('not authorised');
			console.log('not authorised');
			event.preventDefault();
			return;
		}
	});

});

myApp.controller('mainController', function($scope, $rootScope) {
	$scope.root = $rootScope;
});