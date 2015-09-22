angular.module('tempoApp', ['ui.bootstrap'])
    .config(function ($httpProvider) {
        $httpProvider.defaults.useXDomain = true;
        delete $httpProvider.defaults.headers.common['X-Requested-With'];
    })
    .controller('SpotifyCtrl', function ($http) {




        /**
         * Generates a random string containing numbers and letters
         * @param  {number} length The length of the string
         * @return {string} The generated string
         */
        function generateRandomString(length) {
            var text = '';
            var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

            for (var i = 0; i < length; i++) {
                text += possible.charAt(Math.floor(Math.random() * possible.length));
            }
            return text;
        }

        /**
         * Obtains parameters from the hash of the URL
         * @return Object
         */
        function getHashParams() {
            var hashParams = {};
            var e, r = /([^&;=]+)=?([^&;]*)/g,
                q = window.location.hash.substring(1);
            while (e = r.exec(q)) {
                hashParams[e[1]] = decodeURIComponent(e[2]);
            }
            DEBUG(hashParams);
            return hashParams;
        }





        var stateKey = 'spotify_auth_state';
        var params = getHashParams();
        var access_token = params.access_token,
            state = params.state,
            storedState = localStorage.getItem(stateKey);

        if (access_token && (state === null || state !== storedState)) {
            alert('There was an error during the authentication');
        } else {
            localStorage.removeItem(stateKey);
            if (access_token) {
                DEBUG('Access Token');
                $http({
                        url: 'https://api.spotify.com/v1/me',
                        method: "GET",
                        headers: {
                            'Authorization': 'Bearer ' + access_token
                        }
                    })
                    .then(function (response) {
                            DEBUG(response);
                        },
                        function (result) {
                            console.log('Error');
                        });
            } else {

            }
        }









        this.title = "Tempo Console";

        this.playlists = ['One Time', 'Scooby Snacks', 'Hot Dogs', 'Mah Jahms'];

        this.loginUser = function () {
            DEBUG('LOGIN');
            var client_id = '449c07f2e084462395e230d5ce52ebcd'; // Your client id
            var redirect_uri = 'http://localhost:3000/'; // Your redirect uri

            var state = generateRandomString(16);
            localStorage.setItem(stateKey, state);

            var scope = 'playlist-read-private playlist-modify-public';

            var url = 'https://accounts.spotify.com/authorize';
            url += '?response_type=token';
            url += '&client_id=' + encodeURIComponent(client_id);
            url += '&scope=' + encodeURIComponent(scope);
            url += '&redirect_uri=' + encodeURIComponent(redirect_uri);
            url += '&state=' + encodeURIComponent(state);

            window.location = url;
        };


    });









function DEBUG(item) {
    console.log(item);
}