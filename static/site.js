var myApp = angular.module('myApp', ['ngRoute']);

myApp.config(function($routeProvider) {
	$routeProvider
	.when('/', {
		templateUrl : 'pages/formList.html',
		controller  : 'FormListController'
	})

	.when('/form/list', {
		templateUrl : 'pages/formList.html',
		controller  : 'FormListController'
	})
	.when('/form/edit/:id', {
		templateUrl : 'pages/formEdit.html',
		controller  : 'FormEditController'
	})
	.when('/form/fill/:id', {
		templateUrl : 'pages/form.html',
		controller  : 'FormController'
	});
});

myApp.controller('FormEditController', ['$scope', '$http', '$location', function($scope, $http, $location) {
	$scope.form = {fields: [], name: "", submissions: []};
	

	$scope.addField = function(type){
		$scope.form.fields[$scope.form.fields.length] = {
			type: type,
			name: "",
			helper: ""
		}
	}

	$scope.deleteField = function(index){
		$scope.form.fields.splice(index, 1);
	}

	$scope.submitNewForm = function(){
		$http.post('/form/new', {form: $scope.form})
		.then(function(res){
			$location.path( "/form/list" );
		});
	}
}]);

myApp.controller('FormListController', ['$scope', '$http', function($scope, $http) {
	$scope.formsList = {};

	$scope.loadFormList = function(){
		$http.get('/homepage').then(function(res){
			$scope.formsList = res.data;
		});
	}

	$scope.loadFormList();
}]);

myApp.controller('FormController', ['$scope', '$http', '$routeParams', '$location', function($scope, $http, $routeParams, $location) {
	$scope.form = {};
	$scope.formID = $routeParams.id;

	$scope.loadForm = function(){
		$http.get('/form/get/'+$scope.formID).then(function(res){
			$scope.form = res.data;
			console.log(res.data);
		});
	}

	$scope.submitForm = function(){
		var submission = [];
		for(var i = 0; i<$scope.form.fields.length; i++){
			submission[i] = $scope.form.fields[i].value;
		}
		$http.post('/form/submit', {formID: $scope.formID, submission: submission})
		.then(function(res){
			$location.path( "/form/list" );
		});
	}

	$scope.loadForm();
}]);

myApp.controller('mainController', function($scope) {

});