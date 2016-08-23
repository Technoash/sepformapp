var myApp = angular.module('myApp', ['ngRoute']);

myApp.config(function($routeProvider) {
	$routeProvider
	.when('/', {
		templateUrl : 'pages/formList.html',
		controller  : 'FormListController'
	})

	.when('/formList', {
		templateUrl : 'pages/formList.html',
		controller  : 'FormListController'
	})

	.when('/form/:id', {
		templateUrl : 'pages/form.html',
		controller  : 'FormController'
	})
	.when('/edit/:id', {
		templateUrl : 'pages/formEdit.html',
		controller  : 'FormEditController'
	});
});

myApp.controller('FormEditController', ['$scope', '$http', function($scope, $http) {
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
		$http({
		    method: 'POST',
		    url: '/newForm',
		    data: {form: "for"},
		    headers: {'Content-Type': 'application/x-www-form-urlencoded'}
		}).then(function(res){
			

		});
	}
}]);

myApp.controller('FormListController', ['$scope', '$http', function($scope, $http) {
	$scope.formsList = {};

	$scope.loadFormList = function(){
		$http.get('/formlist').then(function(res){
			$scope.formsList = res.data;
		});
	}

	$scope.loadFormList();
}]);

myApp.controller('FormController', ['$scope', '$http', '$routeParams', function($scope, $http, $routeParams) {
	$scope.form = {};
	$scope.formID = $routeParams.id;

	$scope.loadForm = function(){
		$http.get('/getForm/'+$scope.formID).then(function(res){
			$scope.form = res.data;
		});
	}

	$scope.loadForm();
}]);

myApp.controller('mainController', function($scope) {
	$scope.a = "herca hecalee";
});