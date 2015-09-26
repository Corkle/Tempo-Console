angular.module('tempoApp', ['ui.bootstrap', 'rzModule'])
    .config(function ($httpProvider) {
        $httpProvider.defaults.useXDomain = true;
        delete $httpProvider.defaults.headers.common['X-Requested-With'];
    })
    .filter('duration', function () {
        //Returns duration from milliseconds in hh:mm:ss format.
        return function (millseconds) {
            var seconds = Math.floor(millseconds / 1000);
            var h = 3600;
            var m = 60;
            var hours = Math.floor(seconds / h);
            var minutes = Math.floor((seconds % h) / m);
            var scnds = Math.floor((seconds % m));
            var timeString, hourString = '';
            if (scnds < 10) {
                scnds = "0" + scnds;
            }
            //            if (hours < 10) hours = "0" + hours;
            if (minutes < 10 && hours > 0) {
                minutes = "0" + minutes;
            }
            if (hours > 0) {
                hourString = hours + ":";
            }
            timeString = hourString + minutes + ":" + scnds;
            return timeString;
        };
    })
    .filter('tempoRange', function () {
        return function (tracks, min, max) {
            if (tracks) {
                var filterList = [];
                for (var i = 0; i < tracks.length; i++) {
                    var track = tracks[i];
                    var tempo = track.audio_data.tempo;
                    if (tempo >= min && tempo <= max) {
                        filterList.push(track);
                    }
                }
                return filterList;
            }
        };
    })
    .controller('SpotifyCtrl', function ($http, $q, $sce) {




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
            return hashParams;
        }

        function getPlaylistsAsync(userId) {
            var defer = $q.defer();
            $http({
                    url: 'https://api.spotify.com/v1/users/' + userId + '/playlists',
                    method: "GET",
                    headers: {
                        'Authorization': 'Bearer ' + access_token
                    }
                })
                .then(function (response) {
                        var playlists = response.data.items;
                        defer.resolve(playlists);
                    },
                    function (result) {
                        defer.reject(result);
                    });
            return defer.promise;
        }

        function getTracksAsync(playlistUrl) {
            var defer = $q.defer();
            var params = {
                'fields': 'next,items(track(artists,duration_ms,id,name,preview_url))'
            };
            var url = playlistUrl.replace("fields=" + params.fields, "");

            $http({
                    url: url,
                    method: "GET",
                    headers: {
                        'Authorization': 'Bearer ' + access_token
                    },
                    params: params
                })
                .then(function (response) {
                        var tracks = [];
                        var nextUrl = response.data.next;
                        var items = response.data.items;
                        var tracksChecked = 0;
                        var errTracks = 0;

                        var checkTracksLoaded = function () {
                            if (tracksChecked === items.length) {
                                if (errTracks > 0) {
                                    logError(errTracks + ' tracks could not get audio data');
                                }
                                defer.resolve({
                                    tracks: tracks,
                                    nextUrl: nextUrl
                                });
                            }
                        };

                        var foundTrackData = function (trackData) {
                            tracks.push(trackData);
                            tracksChecked++;
                            checkTracksLoaded();
                        };

                        var noTrackData = function (response) {
                                var track = response.track;
                                track.audio_data = {};
                                tracks.push(track);
                                tracksChecked++;
                                errTracks++;
                                checkTracksLoaded();
                        };

                        for (var i = 0; i < items.length; i++) {
                            var item = items[i];
                            var artists = [];

                            for (var j = 0; j < item.track.artists.length; j++) {
                                var artist = item.track.artists[j];
                                artists.push(artist.name);
                            }
                            item.track.artist = artists.join(", ");

                            getTrackDataAsync(item.track)
                                .then(foundTrackData, noTrackData);
                        }
                    },
                    function (err) {
                        defer.reject(err);
                    });
            return defer.promise;
        }

        function getTrackDataAsync(track) {
            var defer = $q.defer();
            var api_key = 'ZALMWFLFASDLR7FHS';
            $http({
                    url: 'http://developer.echonest.com/api/v4/track/profile',
                    method: 'JSONP',
                    params: {
                        api_key: api_key,
                        id: 'spotify:track:' + track.id,
                        format: 'jsonp',
                        callback: 'JSON_CALLBACK',
                        bucket: 'audio_summary'
                    }
                })
                .then(function (response) {
                        if (response.data.response.track) {
                            var trackData = track;
                            trackData.audio_data = response.data.response.track.audio_summary;
                            defer.resolve(trackData);
                        } else {
                            defer.reject({track: track, err: 'Track data not found.'});
                        }
                    },
                    function (err) {
                        defer.reject({track: track, err: err});
                    });
            return defer.promise;
        }


        var spotifyCtrl = this;

        this.sortType = '';
        this.sortReverse = false;
        this.audioSrc = '';
        this.minTempo = 0;
        this.maxTempo = 200;

        this.title = "Tempo Console";

        this.playlists = [];

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
                $http({
                        url: 'https://api.spotify.com/v1/me',
                        method: "GET",
                        headers: {
                            'Authorization': 'Bearer ' + access_token
                        }
                    })
                    .then(function (response) {
                        spotifyCtrl.userData = response.data;
                        getPlaylistsAsync(response.data.id)
                            .then(function (playlists) {
                                spotifyCtrl.playlists = playlists;
                            });
                        spotifyCtrl.showPlaylistData = true;
                    }, logError);
            } else {

            }
        }




        this.loginUser = function () {
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

        this.loadPlaylist = function (playlist) {
            this.selPlaylist = {
                id: playlist.id,
                name: playlist.name
            };
            this.selPlaylist.tracks = [];
            getTracksAsync(playlist.href + '/tracks')
                .then(updateTracks, logError);
        };

        function updateTracks(response) {
            Array.prototype.push.apply(spotifyCtrl.selPlaylist.tracks, response.tracks);
            if (response.nextUrl) {
                getTracksAsync(response.nextUrl)
                    .then(updateTracks, logError);
            }
        }

        function logError(err) {
            console.log(err);
        }

        this.playPreview = function (track) {
            var url = $sce.trustAsResourceUrl(track.preview_url);
            this.audioSrc = url;
        };

        this.filterTempo = function () {

        };
    });




function DEBUG(name, item) {
    console.log(name);
    console.log(item);
}